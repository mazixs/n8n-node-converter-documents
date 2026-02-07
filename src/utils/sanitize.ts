import { FileTypeError } from "../errors";

/**
 * Безопасная валидация и очистка имени файла
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'unknown_file';
  }
  
  // Проверка на path traversal
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new FileTypeError('Invalid file name: contains path traversal characters');
  }
  
  // Удаляем опасные символы
  const dangerousChars = /[<>:"|?*]/g;
  // eslint-disable-next-line no-control-regex
  const controlChars = /[\x00-\x1f\x7f-\x9f]/g;
  const sanitized = fileName.replace(dangerousChars, '_').replace(controlChars, '_');
  
  // Ограничиваем длину
  return sanitized.length > 255 ? sanitized.substring(0, 255) : sanitized;
}
