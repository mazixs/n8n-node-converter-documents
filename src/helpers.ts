// Вспомогательные функции для работы с файлами в кастомном ноде n8n
import { parseOfficeAsync } from 'officeparser';

/**
 * Извлекает текст из буфера с помощью officeparser
 * 
 * @param buffer - Буфер с содержимым файла
 * @returns Promise с извлеченным текстом
 * @throws Error если файл не удалось обработать
 * 
 * @example
 * const text = await extractViaOfficeParser(fileBuffer);
 */
export function extractViaOfficeParser(
  buffer: Buffer
): Promise<string> {
  return parseOfficeAsync(buffer);
}

/**
 * @deprecated Устаревшая функция для обратной совместимости
 * Используйте extractViaOfficeParser вместо этой функции
 * 
 * @param buffer - Буфер с содержимым файла
 * @param _mime - MIME-тип (не используется)
 * @param _textract - Ссылка на textract (не используется)
 * @returns Promise с извлеченным текстом
 */
export function extractViaTextract(
  buffer: Buffer,
  _mime: string,
  _textract: unknown
): Promise<string> {
  return extractViaOfficeParser(buffer);
}

/**
 * Ограничивает количество строк в Excel-таблице
 * 
 * @param sheet - Массив строк из Excel
 * @param maxRows - Максимальное количество строк (по умолчанию 10,000)
 * @returns Ограниченный массив строк
 * 
 * @example
 * const limited = limitExcelSheet(allRows, 5000);
 */
export function limitExcelSheet(
  sheet: unknown[],
  maxRows: number = 10_000
): unknown[] {
  return sheet.length > maxRows ? sheet.slice(0, maxRows) : sheet;
}
