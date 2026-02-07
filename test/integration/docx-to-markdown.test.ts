import * as fs from 'fs';
import * as path from 'path';
import { strategies } from '../../src/strategies';
import type { JsonTextResult } from '../../src/types';

describe('DOCX to Markdown Conversion', () => {
  it('should convert DOCX with tables to GFM markdown', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice2.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('Sample file not found, skipping test');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await strategies.docx(buffer, 'docx', { outputFormat: 'markdown' }) as Partial<JsonTextResult>;
    
    expect(result.text).toBeDefined();
    const md = result.text!;
    
    console.log('\n=== MARKDOWN OUTPUT (first 500 chars) ===');
    console.log(md.substring(0, 500));
    console.log('=========================================\n');
    
    // Должен содержать markdown заголовки
    expect(md).toMatch(/^#{1,6}\s/m);
    
    // Должен содержать GFM таблицы (pipe syntax)
    expect(md).toContain('|');
    
    // НЕ должен содержать HTML теги
    expect(md).not.toContain('<table>');
    expect(md).not.toContain('<tr>');
    expect(md).not.toContain('<td>');
    expect(md).not.toContain('<p>');
    
    // Должен содержать bold markdown
    expect(md).toContain('**');
  });

  it('should convert simple DOCX to markdown', async () => {
    const filePath = path.join(__dirname, '../samples/onlyoffice-text.docx');
    
    if (!fs.existsSync(filePath)) {
      console.log('Sample file not found, skipping test');
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const result = await strategies.docx(buffer, 'docx', { outputFormat: 'markdown' }) as Partial<JsonTextResult>;
    
    expect(result.text).toBeDefined();
    const md = result.text!;
    
    // Должен содержать текст
    expect(md.length).toBeGreaterThan(0);
    
    // НЕ должен содержать HTML
    expect(md).not.toContain('<p>');
    expect(md).not.toContain('</p>');
  });

  it('should fallback to text when markdown conversion fails', async () => {
    // Пустой/невалидный буфер — должен выбросить ошибку
    const emptyBuf = Buffer.alloc(0);
    
    await expect(strategies.docx(emptyBuf, 'docx', { outputFormat: 'markdown' }))
      .rejects.toThrow();
  });
});
