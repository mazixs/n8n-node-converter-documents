// Настройки для Jest тестов
import 'jest';

// Увеличиваем timeout для тестов с файлами
jest.setTimeout(30000);

// Типы для global объекта
declare global {
  var mockN8nHelpers: {
    getBinaryDataBuffer: jest.Mock;
  };
}

// Mock для n8n helpers если нужно
export const mockN8nHelpers = {
  getBinaryDataBuffer: jest.fn(),
};

(global as unknown as { mockN8nHelpers: typeof mockN8nHelpers }).mockN8nHelpers = mockN8nHelpers; 