/**
 * Функция для нормализации JSON объектов
 * Преобразует многоуровневые структуры в плоский объект
 */
export function flattenJsonObject(obj: unknown, prefix: string = '', result: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return result;
  }

  if (typeof obj !== 'object' || obj instanceof Date || Buffer.isBuffer(obj)) {
    result[prefix || 'value'] = obj;
    return result;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const key = prefix ? `${prefix}[${index}]` : `item_${index}`;
      flattenJsonObject(item, key, result);
    });
    return result;
  }

  Object.keys(obj).forEach(key => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    flattenJsonObject((obj as Record<string, unknown>)[key], newKey, result);
  });

  return result;
}
