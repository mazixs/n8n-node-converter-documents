// Вспомогательные функции для работы с файлами в кастомном ноде n8n
import { parseOffice } from 'officeparser';

/**
 * Извлекает текст из буфера с помощью officeparser
 * 
 * @param buffer - Буфер с содержимым файла
 * @returns Promise с извлеченным текстом
 * @throws Error если файл не удалось обработать
 */
export async function extractViaOfficeParser(
  buffer: Buffer
): Promise<string> {
  const ast = await parseOffice(buffer);
  return ast.toText();
}
