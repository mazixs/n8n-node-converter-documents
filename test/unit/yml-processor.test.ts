import { XMLParser } from 'fast-xml-parser';
import { processYandexMarketYml } from '../../src/processors/yml';
import type { YmlCatalog } from '../../src/types';

describe('YML Processor Unit Tests', () => {
  const sampleYmlXml = `<?xml version="1.0" encoding="UTF-8"?>
  <yml_catalog date="2024-01-15 12:00">
    <shop>
      <name>Интернет-магазин "Технотест"</name>
      <company>ООО "Технотест"</company>
      <url>https://example.com</url>
      <platform>uCoz</platform>
      
      <delivery-options>
        <option cost="300" days="1" order-before="18"/>
      </delivery-options>
      <pickup-options>
        <option cost="0" days="2" order-before="12"/>
      </pickup-options>
      
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
          <delivery-options>
            <option cost="0" days="0" order-before="15"/>
          </delivery-options>
        </offer>
      </offers>
    </shop>
  </yml_catalog>`;

  test('should process YML structure correctly', () => {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(sampleYmlXml);
    const result = processYandexMarketYml(parsed);
    
    expect(result.text).toBeDefined();
    const catalog = JSON.parse(result.text!).yandex_market_catalog;
    
    expect(catalog.shop_info.name).toBe('Интернет-магазин "Технотест"');
    expect(catalog.shop_info.company).toBe('ООО "Технотест"');
    expect(catalog.shop_info.url).toBe('https://example.com');
    expect(catalog.shop_info.platform).toBe('uCoz');
    expect(catalog.shop_info.date).toBe('2024-01-15 12:00');
    
    // Shop-level delivery/pickup options
    expect(catalog.delivery_options).toHaveLength(1);
    expect(catalog.delivery_options[0].cost).toBe('300');
    expect(catalog.delivery_options[0].days).toBe('1');
    expect(catalog.delivery_options[0].orderBefore).toBe('18');
    
    expect(catalog.pickup_options).toHaveLength(1);
    expect(catalog.pickup_options[0].cost).toBe('0');
    expect(catalog.pickup_options[0].days).toBe('2');
    
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
    expect(offer.price).toBe(89990);
    expect(offer.parameters).toHaveLength(2);
    
    // Offer-level delivery options
    expect(offer.deliveryOptions).toHaveLength(1);
    expect(offer.deliveryOptions[0].days).toBe('0');
    expect(offer.deliveryOptions[0].orderBefore).toBe('15');
    
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
    
    const catalog = JSON.parse(result.text!).yandex_market_catalog;
    expect(catalog.shop_info.name).toBe('Test Shop');
    expect(catalog.currencies).toHaveLength(0);
    expect(catalog.categories).toHaveLength(0);
    expect(catalog.offers).toHaveLength(0);
    expect(catalog.delivery_options).toHaveLength(0);
    expect(catalog.pickup_options).toHaveLength(0);
    expect(catalog.shop_info.platform).toBe('');
  });

  test('should throw ProcessingError on invalid input', () => {
    expect(() => processYandexMarketYml({} as never))
      .toThrow('YML catalog processing error');
  });

  test('should preserve numeric and boolean falsey values', () => {
    const parsed = {
      yml_catalog: {
        shop: {
          name: 'Falsey Shop',
          currencies: { currency: { id: 0, rate: 0 } },
          offers: {
            offer: {
              id: 0,
              available: false,
              price: 0,
              delivery: false,
              'delivery-options': { option: { cost: 0, days: 0 } },
            },
          },
        },
      },
    } as unknown as YmlCatalog;

    const result = processYandexMarketYml(parsed);
    const catalog = JSON.parse(result.text).yandex_market_catalog;

    expect(catalog.currencies[0]).toEqual({ id: 0, rate: 0 });
    expect(catalog.offers[0]).toEqual(expect.objectContaining({
      id: 0,
      available: false,
      price: 0,
      delivery: false,
    }));
    expect(catalog.offers[0].deliveryOptions[0]).toEqual(expect.objectContaining({ cost: 0, days: 0 }));
    expect(catalog.statistics.available_offers).toBe(0);
    expect(catalog.statistics.unavailable_offers).toBe(1);
  });
});
