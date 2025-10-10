// Кастомные классы ошибок для нода n8n

/**
 * Базовый класс для всех кастомных ошибок конвертера
 */
class BaseConverterError extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;
    
    // Сохраняем правильный stack trace в Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Ошибка неверного типа файла
 */
export class FileTypeError extends BaseConverterError {
  constructor(message: string) {
    super(message, 'FileTypeError');
  }
}

/**
 * Ошибка превышения размера файла
 */
export class FileTooLargeError extends BaseConverterError {
  constructor(message: string) {
    super(message, 'FileTooLargeError');
  }
}

/**
 * Ошибка неподдерживаемого формата
 */
export class UnsupportedFormatError extends BaseConverterError {
  constructor(message: string) {
    super(message, 'UnsupportedFormatError');
  }
}

/**
 * Ошибка пустого файла
 */
export class EmptyFileError extends BaseConverterError {
  constructor(message: string) {
    super(message, 'EmptyFileError');
  }
}

/**
 * Ошибка обработки файла
 */
export class ProcessingError extends BaseConverterError {
  constructor(message: string) {
    super(message, 'ProcessingError');
  }
} 