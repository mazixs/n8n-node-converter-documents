import fs from 'fs';
import path from 'path';
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
  it('pins officeparser to the installed compatible version under a fresh package name', () => {
    const projectManifest = readManifest(path.resolve(__dirname, '../../package.json'));
    const officeParserManifest = readManifest(
      path.resolve(path.dirname(require.resolve('officeparser-modern')), '../package.json'),
    );
    const declaredVersion = projectManifest.dependencies?.['officeparser-modern'];

    expect(declaredVersion).toBe('npm:officeparser@6.0.7');
    expect(officeParserManifest.version).toBe('6.0.7');
  });

  /*
   * Состав копий pdfjs-dist зафиксирован осознанно, а не является случайным следствием
   * резолвинга npm.
   *
   * Идеальное состояние — одна копия: именно вложенная вторая копия ломала PDF-воркер
   * в 1.4.3-1.4.5, и хак в src/helpers.ts существует ровно из-за неё. Дедуплицировать её
   * сегодня можно только поднявшись на pdfjs-dist 5.6.205 (pdf-to-img 6.x требует
   * ~5.6.205), но весь диапазон >=5.6.83 <6.2.108 закрыт advisory GHSA-hq66-cqwq-w95j:
   * исполнение произвольного JavaScript при открытии недоверенного PDF. В ветке 5.x
   * исправления нет вовсе, а officeparser 7.5.1 жёстко пинит 6.1.200 — тоже уязвимую.
   * Безопасной комбинации с одной копией на сегодня не существует, поэтому две копии
   * вне уязвимого диапазона выбраны как меньшее зло.
   *
   * Условие выхода: релиз pdf-to-img или officeparser с pdfjs-dist 6.2.108+. Тогда
   * обновляемся, снова получаем дедупликацию и ужесточаем тест до одной копии.
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
    const projectManifest = readManifest(path.join(projectRoot, 'package.json'));
    const declaredVersion = projectManifest.dependencies?.['pdfjs-dist'];

    expect(declaredVersion).toMatch(/^\d+\.\d+\.\d+$/);

    const copies = findInstalledCopies(path.join(projectRoot, 'node_modules'), 'pdfjs-dist');
    const versionsByPath = copies.map((manifestPath) => ({
      path: path.relative(projectRoot, manifestPath),
      version: readManifest(manifestPath).version as string,
    }));

    // Копия в корне — та, которую грузят src/helpers.ts и officeparser-modern.
    expect(versionsByPath).toContainEqual({
      path: path.join('node_modules', 'pdfjs-dist', 'package.json'),
      version: declaredVersion,
    });

    // Вторая копия принадлежит pdf-to-img и существует только из-за advisory (см. выше).
    const versions = versionsByPath.map((copy) => copy.version).sort(compareVersions);
    expect(versions).toEqual(['5.4.624', '5.5.207']);
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
});
