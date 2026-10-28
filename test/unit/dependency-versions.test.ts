import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';

type PackageManifest = {
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

function readManifest(manifestPath: string): PackageManifest {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest;
}

/**
 * Собирает все физические копии пакета в дереве node_modules.
 * Нужен именно обход файловой системы, а не `npm ls`: вложенная копия
 * pdfjs-dist — это то, из-за чего в 1.4.3-1.4.5 ломался PDF-воркер.
 */
function findInstalledCopies(nodeModulesPath: string, packageName: string): string[] {
  const found: string[] = [];

  const visit = (directory: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name === '.bin' || entry.name === '.package-lock.json') continue;

      const entryPath = path.join(directory, entry.name);

      if (entry.name === packageName) {
        const manifestPath = path.join(entryPath, 'package.json');
        if (fs.existsSync(manifestPath)) found.push(manifestPath);
      }

      // Пакеты со scope и вложенные node_modules раскрываем дальше.
      if (entry.name.startsWith('@')) {
        visit(entryPath);
        continue;
      }
      const nested = path.join(entryPath, 'node_modules');
      if (fs.existsSync(nested)) visit(nested);
    }
  };

  visit(nodeModulesPath);
  return found;
}

describe('production dependency versions', () => {
  it('pins officeparser 8 under a fresh package name', () => {
    const projectManifest = readManifest(path.resolve(__dirname, '../../package.json'));
    const officeParserManifest = readManifest(
      path.resolve(path.dirname(require.resolve('officeparser-v8')), '../package.json'),
    );

    // Старое имя держит в кэше работающего n8n путь к officeparser 6.0.7 (см. docs/).
    // Версия officeparser с другой pdfjs-dist требует нового имени алиаса:
    // docs/2026-10-28-officeparser-8.md.
    expect(projectManifest.dependencies?.['officeparser-modern']).toBeUndefined();
    expect(projectManifest.dependencies?.['officeparser-v8']).toBe('npm:officeparser@8.4.0');
    expect(officeParserManifest.version).toBe('8.4.0');
  });

  /*
   * pdfjs-dist намеренно не объявлен прямой зависимостью.
   *
   * До 1.5.0 включительно он лежал в корне пакета (node_modules/pdfjs-dist, 5.5.207) и
   * грузился в процесс n8n как ESM. Кэш ESM-модулей Node не сбрасывается до перезапуска,
   * поэтому новая версия по тому же пути после обновления на лету получила бы старый
   * API 5.5.207 рядом с новым worker'ом — ошибка «API version does not match the Worker
   * version», уже знакомая по 1.4.3-1.4.5. n8n ставит зависимости с
   * --install-strategy=shallow: прямые — в корень, их собственные — внутрь. Без прямого
   * объявления pdfjs-dist ложится в officeparser-v8/node_modules — новый путь и свежий
   * модуль.
   */
  it('leaves pdfjs-dist to officeparser so n8n nests it under a fresh path', () => {
    const projectManifest = readManifest(path.resolve(__dirname, '../../package.json'));
    const pdfjsManifestPath = createRequire(require.resolve('officeparser-v8'))
      .resolve('pdfjs-dist/package.json');

    expect(projectManifest.dependencies?.['pdfjs-dist']).toBeUndefined();
    expect(readManifest(pdfjsManifestPath).version).toBe('6.2.108');
  });

  /*
   * Состав копий pdfjs-dist зафиксирован осознанно, а не является случайным следствием
   * резолвинга npm.
   *
   * Весь диапазон >=5.6.83 <6.2.108 закрыт advisory GHSA-hq66-cqwq-w95j: исполнение
   * произвольного JavaScript при открытии недоверенного PDF. officeparser 8.4.0 пинит
   * 6.2.108 — первую исправленную версию, поэтому разбор PDF вышел из диапазона.
   *
   * Вторая копия, 5.4.624, принадлежит pdf-to-img и нужна только опциональному OCR.
   * Условие выхода: OCR перестаёт зависеть от pdf-to-img. Тогда ужесточаем тест до одной
   * копии.
   */
  const VULNERABLE_RANGE = { fromInclusive: '5.6.83', untilExclusive: '6.2.108' };

  function compareVersions(left: string, right: string): number {
    const leftParts = left.split('.').map(Number);
    const rightParts = right.split('.').map(Number);
    for (let index = 0; index < 3; index += 1) {
      if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
    }
    return 0;
  }

  it('keeps the pdfjs-dist copies at the deliberately pinned composition', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const copies = findInstalledCopies(path.join(projectRoot, 'node_modules'), 'pdfjs-dist');
    const versions = copies
      .map((manifestPath) => readManifest(manifestPath).version as string)
      .sort(compareVersions);

    // 6.2.108 — копия officeparser-v8, 5.4.624 — копия pdf-to-img для OCR (см. выше).
    expect(versions).toEqual(['5.4.624', '6.2.108']);
  });

  it('keeps every pdfjs-dist copy out of the GHSA-hq66-cqwq-w95j range', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const copies = findInstalledCopies(path.join(projectRoot, 'node_modules'), 'pdfjs-dist');

    expect(copies.length).toBeGreaterThan(0);

    for (const manifestPath of copies) {
      const version = readManifest(manifestPath).version as string;
      const isVulnerable = compareVersions(version, VULNERABLE_RANGE.fromInclusive) >= 0
        && compareVersions(version, VULNERABLE_RANGE.untilExclusive) < 0;

      expect({ path: path.relative(projectRoot, manifestPath), version, isVulnerable }).toEqual({
        path: path.relative(projectRoot, manifestPath),
        version,
        isVulnerable: false,
      });
    }
  });

  it('loads file-type through the native ESM bridge and detects a PDF signature', () => {
    const script = [
      "const { fileTypeFromBuffer } = require('./src/file-type-loader');",
      "fileTypeFromBuffer(Buffer.from('%PDF-1.7\\n')).then((type) => process.stdout.write(type?.ext || ''));",
    ].join('\n');

    const extension = execFileSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });

    expect(extension).toBe('pdf');
  });

  /*
   * hucre публикуется только как ESM. Сборка грузит его обычным require(): Node с 22.12
   * отдаёт ESM без top-level await через require(esm), а hucre такой. В Jest он
   * транспилируется в CJS (jest.config.js), поэтому настоящую загрузку проверяем здесь,
   * в отдельном процессе на той версии Node, на которой идёт CI.
   */
  it('pins hucre and loads it through require(esm) in plain Node', () => {
    const projectManifest = readManifest(path.resolve(__dirname, '../../package.json'));
    const script = [
      "const { read, readXlsx, readXls, readXlsb } = require('hucre');",
      "process.stdout.write([read, readXlsx, readXls, readXlsb].map((fn) => typeof fn).join(','));",
    ].join('\n');

    const loaded = execFileSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });

    expect(projectManifest.dependencies?.['read-excel-file']).toBeUndefined();
    expect(projectManifest.dependencies?.hucre).toBe('1.3.0');
    expect(loaded).toBe('function,function,function,function');
  });
});
