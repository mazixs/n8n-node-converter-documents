import { XMLParser } from 'fast-xml-parser';

// Копируем функцию processYandexMarketYml для тестирования из основного файла
// Обновленная логика под fast-xml-parser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processYandexMarketYml(parsed: any): { text: string; warning?: string } {
  try {
    const catalog = parsed.yml_catalog;
    const shop = Array.isArray(catalog.shop) ? catalog.shop[0] : catalog.shop;
    
    const shopInfo = {
      name: shop.name || 'Unknown Shop',
      company: shop.company || '',
      url: shop.url || '',
      date: catalog['@_date'] || catalog.date || ''
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currencies: any[] = [];
    if (shop.currencies?.currency) {
      const currencyList = Array.isArray(shop.currencies.currency) ? shop.currencies.currency : [shop.currencies.currency];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currencies.push(...currencyList.map((curr: any) => ({
        id: curr['@_id'] || curr.id,
        rate: curr['@_rate'] || curr.rate || '1'
      })));
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const categories: any[] = [];
    if (shop.categories?.category) {
      const categoryList = Array.isArray(shop.categories.category) ? shop.categories.category : [shop.categories.category];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories.push(...categoryList.map((cat: any) => ({
        id: cat['@_id'] || cat.id,
        name: cat['#text'] || cat.name || String(cat),
        parentId: cat['@_parentId'] || cat.parentId || null
      })));
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offers: any[] = [];
    if (shop.offers?.offer) {
      const offerList = Array.isArray(shop.offers.offer) ? shop.offers.offer : [shop.offers.offer];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      offers.push(...offerList.map((offer: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offerData: any = {
          id: offer['@_id'] || offer.id,
          available: offer['@_available'] || offer.available || 'true',
          name: offer.name || '',
          url: offer.url || '',
          price: offer.price || '',
          currencyId: offer.currencyId || '',
          categoryId: offer.categoryId || '',
          vendor: offer.vendor || '',
          description: offer.description || ''
        };
        
        const optionalFields = ['oldprice', 'vendorCode', 'barcode', 'sales_notes', 'delivery', 'pickup'];
        optionalFields.forEach(field => {
            if (offer[field]) offerData[field] = offer[field];
        });
        
        if (offer.picture) {
          const pictures = Array.isArray(offer.picture) ? offer.picture : [offer.picture];
          offerData.pictures = pictures.map((pic: string) => pic || '');
        }
        
        if (offer.param) {
          const params = Array.isArray(offer.param) ? offer.param : [offer.param];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          offerData.parameters = params.map((param: any) => ({
            name: param['@_name'] || param.name,
            value: param['#text'] || param.value || String(param),
            unit: param['@_unit'] || param.unit || null
          }));
        }
        return offerData;
      }));
    }
    
    const result = {
      yandex_market_catalog: {
        shop_info: shopInfo,
        currencies: currencies,
        categories: categories,
        offers: offers,
        statistics: {
          total_categories: categories.length,
          total_offers: offers.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          available_offers: offers.filter((o: any) => o.available === 'true' || o.available === true).length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unavailable_offers: offers.filter((o: any) => o.available === 'false' || o.available === false).length
        }
      }
    };
    
    return { 
      text: JSON.stringify(result, null, 2),
      warning: offers.length > 1000 ? `Большой каталог: ${offers.length} товаров` : undefined
    };
  } catch (error) {
    throw new Error(`YML catalog processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

describe('YML Processor Unit Tests', () => {
  const sampleYmlXml = `<?xml version="1.0" encoding="UTF-8"?>
  <yml_catalog date="2024-01-15 12:00">
    <shop>
      <name>Интернет-магазин "Технотест"</name>
      <company>ООО "Технотест"</company>
      <url>https://example.com</url>
      
      <currencies>
        <currency id="RUR" rate="1"/>
      </currencies>
      
      <categories>
        <category id="1">Электроника</category>
        <category id="2" parentId="1">Смартфоны</category>
      </categories>
      
      <offers>
        <offer id="12345" available="true">
          <name>Смартфон Apple iPhone 15 128GB</name>
          <url>https://example.com/iphone15</url>
          <price>89990</price>
          <oldprice>99990</oldprice>
          <currencyId>RUR</currencyId>
          <categoryId>2</categoryId>
          <vendor>Apple</vendor>
          <vendorCode>IPHONE15-128</vendorCode>
          <picture>https://example.com/images/iphone15_1.jpg</picture>
          <description>Новый iPhone 15</description>
          <param name="Цвет">Черный</param>
          <param name="Память">128 ГБ</param>
          <delivery>true</delivery>
          <pickup>true</pickup>
        </offer>
      </offers>
    </shop>
  </yml_catalog>`;

  test('should process YML structure correctly', () => {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(sampleYmlXml);
    const result = processYandexMarketYml(parsed);
    
    expect(result.text).toBeDefined();
    const catalog = JSON.parse(result.text).yandex_market_catalog;
    
    expect(catalog.shop_info.name).toBe('Интернет-магазин "Технотест"');
    expect(catalog.shop_info.company).toBe('ООО "Технотест"');
    expect(catalog.shop_info.url).toBe('https://example.com');
    expect(catalog.shop_info.date).toBe('2024-01-15 12:00');
    
    expect(catalog.currencies).toHaveLength(1);
    expect(catalog.currencies[0].id).toBe('RUR');
    expect(catalog.currencies[0].rate).toBe('1');
    
    expect(catalog.categories).toHaveLength(2);
    expect(catalog.categories[0].name).toBe('Электроника');
    expect(catalog.categories[1].name).toBe('Смартфоны');
    expect(catalog.categories[1].parentId).toBe('1');
    
    expect(catalog.offers).toHaveLength(1);
    const offer = catalog.offers[0];
    expect(offer.id).toBe('12345');
    expect(offer.name).toBe('Смартфон Apple iPhone 15 128GB');
    expect(offer.vendor).toBe('Apple');
    expect(offer.price).toBe(89990); // fast-xml-parser converts numbers
    expect(offer.parameters).toHaveLength(2);
    
    expect(catalog.statistics.total_categories).toBe(2);
    expect(catalog.statistics.total_offers).toBe(1);
    expect(catalog.statistics.available_offers).toBe(1);
  });

  test('should handle empty sections gracefully', () => {
    const minimalYml = `<?xml version="1.0"?>
    <yml_catalog>
      <shop>
        <name>Test Shop</name>
      </shop>
    </yml_catalog>`;
    
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(minimalYml);
    const result = processYandexMarketYml(parsed);
    
    const catalog = JSON.parse(result.text).yandex_market_catalog;
    expect(catalog.shop_info.name).toBe('Test Shop');
    expect(catalog.currencies).toHaveLength(0);
    expect(catalog.categories).toHaveLength(0);
    expect(catalog.offers).toHaveLength(0);
  });
});
