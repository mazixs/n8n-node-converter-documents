/**
 * Конвертация номера колонки в букву (A, B, C... Z, AA, AB...)
 */
export function numberToColumn(num: number): string {
  let result = '';
  while (num > 0) {
    num--; // Делаем 0-based
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}
