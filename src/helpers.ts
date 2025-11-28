// Вспомогательные функции для работы с файлами в кастомном ноде n8n
import { parseOfficeAsync } from 'officeparser';

/**
 * Извлекает текст из буфера с помощью officeparser
 * 
 * @param buffer - Буфер с содержимым файла
 * @returns Promise с извлеченным текстом
 * @throws Error если файл не удалось обработать
 */
export function extractViaOfficeParser(
  buffer: Buffer
): Promise<string> {
  return parseOfficeAsync(buffer);
}

/**
 * Ограничивает количество строк в Excel-таблице
 * 
 * @param sheet - Массив строк из Excel
 * @param maxRows - Максимальное количество строк (0 = без лимита)
 * @returns Ограниченный массив строк
 */
export function limitExcelSheet(
  sheet: unknown[],
  maxRows: number
): unknown[] {
  if (maxRows <= 0) return sheet;
  return sheet.length > maxRows ? sheet.slice(0, maxRows) : sheet;
}
