import { ProcessingError } from "../errors";
import type { JsonResult, YmlCatalog, YmlCurrency, YmlCategory, YmlOffer, YmlDeliveryOption } from "../types";

function getVal<T>(val: T | T[] | undefined): T | undefined {
  if (val === undefined) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

function parseDeliveryOptions(container: { option: YmlDeliveryOption | YmlDeliveryOption[] } | undefined): unknown[] {
  if (!container || !container.option) return [];
  const list = Array.isArray(container.option) ? container.option : [container.option];
  return list.map((opt) => ({
    cost: opt["@_cost"] || opt.cost || '0',
    days: opt["@_days"] || opt.days || '',
    orderBefore: opt["@_order-before"] || opt["order-before"] || null
  }));
}

/**
 * Обработка YML файлов Яндекс Маркета
 * Преобразует XML структуру в удобный для анализа JSON формат
 */
export function processYandexMarketYml(parsed: YmlCatalog): Partial<JsonResult> {
  try {
    const catalog = parsed.yml_catalog;
    const shop = catalog.shop;
    
    const shopInfo = {
      name: getVal(shop.name) || 'Unknown Shop',
      company: getVal(shop.company) || '',
      url: getVal(shop.url) || '',
      platform: getVal(shop.platform) || '',
      date: catalog["@_date"] || catalog.date || ''
    };

    const shopDeliveryOptions = parseDeliveryOptions(shop["delivery-options"]);
    const shopPickupOptions = parseDeliveryOptions(shop["pickup-options"]);
    
    const currencies: unknown[] = [];
    if (shop.currencies && shop.currencies.currency) {
      const currencyList = Array.isArray(shop.currencies.currency) 
        ? shop.currencies.currency 
        : [shop.currencies.currency];
      
      currencies.push(...currencyList.map((curr: YmlCurrency) => ({
        id: curr["@_id"] || curr.id,
        rate: curr["@_rate"] || curr.rate || '1'
      })));
    }
    
    const categories: unknown[] = [];
    if (shop.categories && shop.categories.category) {
      const categoryList = Array.isArray(shop.categories.category) 
        ? shop.categories.category 
        : [shop.categories.category];
      
      categories.push(...categoryList.map((cat: YmlCategory) => ({
        id: cat["@_id"] || cat.id,
        name: cat["#text"] || cat.name || String(cat),
        parentId: cat["@_parentId"] || cat.parentId || null
      })));
    }
    
    const offers: unknown[] = [];
    if (shop.offers && shop.offers.offer) {
      const offerList = Array.isArray(shop.offers.offer) 
        ? shop.offers.offer 
        : [shop.offers.offer];
      
      offers.push(...offerList.map((offer: YmlOffer) => {
        const offerData: Record<string, unknown> = {
          id: offer["@_id"] || offer.id,
          available: offer["@_available"] || offer.available || 'true',
          name: getVal(offer.name) || '',
          url: getVal(offer.url) || '',
          price: getVal(offer.price) || '',
          currencyId: getVal(offer.currencyId) || '',
          categoryId: getVal(offer.categoryId) || '',
          vendor: getVal(offer.vendor) || '',
          description: getVal(offer.description) || ''
        };
        
        if (offer.oldprice) offerData.oldprice = getVal(offer.oldprice);
        if (offer.vendorCode) offerData.vendorCode = getVal(offer.vendorCode);
        if (offer.barcode) offerData.barcode = getVal(offer.barcode);
        if (offer.sales_notes) offerData.sales_notes = getVal(offer.sales_notes);
        if (offer.delivery) offerData.delivery = getVal(offer.delivery);
        if (offer.pickup) offerData.pickup = getVal(offer.pickup);
        
        const offerDeliveryOpts = parseDeliveryOptions(offer["delivery-options"]);
        if (offerDeliveryOpts.length > 0) offerData.deliveryOptions = offerDeliveryOpts;
        const offerPickupOpts = parseDeliveryOptions(offer["pickup-options"]);
        if (offerPickupOpts.length > 0) offerData.pickupOptions = offerPickupOpts;
        
        if (offer.picture) {
          const pictures = Array.isArray(offer.picture) ? offer.picture : [offer.picture];
          offerData.pictures = pictures.map((pic: string) => pic || '');
        }
        
        if (offer.param) {
          const params = Array.isArray(offer.param) ? offer.param : [offer.param];
          offerData.parameters = params.map((param) => ({
            name: param["@_name"] || param.name,
            value: param["#text"] || param.value || String(param),
            unit: param["@_unit"] || param.unit || null
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
        delivery_options: shopDeliveryOptions,
        pickup_options: shopPickupOptions,
        offers: offers,
        statistics: {
          total_categories: categories.length,
          total_offers: offers.length,
          available_offers: offers.filter((o) => (o as Record<string, unknown>).available === 'true' || (o as Record<string, unknown>).available === true).length,
          unavailable_offers: offers.filter((o) => (o as Record<string, unknown>).available === 'false' || (o as Record<string, unknown>).available === false).length
        }
      }
    };
    
    return { 
      text: JSON.stringify(result, null, 2),
      warning: offers.length > 1000 ? `Большой каталог: ${offers.length} товаров` : undefined
    };
  } catch (error) {
    throw new ProcessingError(`YML catalog processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
