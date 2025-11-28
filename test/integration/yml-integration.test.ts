import { readFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';

describe('YML Integration Tests', () => {
  test('should parse Yandex Market YML file structure', async () => {
    const filePath = join(__dirname, '../samples/sample_yandex_market.yml');
    const ymlContent = readFileSync(filePath, 'utf8');
    
    // Проверяем, что файл содержит правильную структуру
    expect(ymlContent).toContain('yml_catalog');
    expect(ymlContent).toContain('<shop>');
    expect(ymlContent).toContain('<offers>');
    expect(ymlContent).toContain('<categories>');
    expect(ymlContent).toContain('Смартфон Apple iPhone 15');
    expect(ymlContent).toContain('Электроника');
    
    // Проверяем атрибуты
    expect(ymlContent).toContain('id="12345"');
    expect(ymlContent).toContain('available="true"');
    expect(ymlContent).toContain('parentId="1"');
  });
  
  test('should handle YML file with XML parsing', async () => {
    const filePath = join(__dirname, '../samples/sample_yandex_market.yml');
    const ymlContent = readFileSync(filePath, 'utf8');
    
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(ymlContent);
    
    // Проверяем основную структуру
    expect(parsed.yml_catalog).toBeDefined();
    expect(parsed.yml_catalog.shop).toBeDefined();
    
    const shop = parsed.yml_catalog.shop;
    // В fast-xml-parser, если элемент один, это объект, а не массив
    expect(shop.name).toBe('Интернет-магазин "Технотест"');
    expect(shop.company).toBe('ООО "Технотест"');
    
    // Проверяем категории
    expect(shop.categories.category).toBeDefined();
    // В сэмпле несколько категорий, поэтому это должен быть массив
    expect(Array.isArray(shop.categories.category)).toBe(true);
    expect(shop.categories.category.length).toBe(5);
    
    // Проверяем товары
    expect(shop.offers.offer).toBeDefined();
    expect(Array.isArray(shop.offers.offer)).toBe(true);
    expect(shop.offers.offer.length).toBe(3);
    
    const firstOffer = shop.offers.offer[0];
    // Атрибуты начинаются с @_
    expect(firstOffer['@_id']).toBe('12345');
    expect(firstOffer['@_available']).toBe('true');
    expect(firstOffer.name).toBe('Смартфон Apple iPhone 15 128GB');
  });
});
