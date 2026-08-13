import { ProcessingError } from "../errors";
import type {
  StrategyTextResult,
  YmlCatalog,
  YmlDeliveryOption,
  YmlOffer,
  YmlScalar,
} from "../types";

function firstValue<T>(value: T | T[] | undefined): T | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return values.at(-1);
}

function parseDeliveryOptions(
  container: { option: YmlDeliveryOption | YmlDeliveryOption[] } | undefined,
): Record<string, unknown>[] {
  return asArray(container?.option).map((option) => ({
    cost: firstDefined(option["@_cost"], option.cost, "0"),
    days: firstDefined(option["@_days"], option.days, ""),
    orderBefore: firstDefined(option["@_order-before"], option["order-before"], null),
  }));
}

function addOptionalScalar(
  target: Record<string, unknown>,
  key: string,
  value: YmlScalar | YmlScalar[] | undefined,
): void {
  const scalar = firstValue(value);
  if (scalar !== undefined) target[key] = scalar;
}

function normalizeOffer(offer: YmlOffer): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    id: firstDefined(offer["@_id"], offer.id),
    available: firstDefined(offer["@_available"], offer.available, "true"),
    name: firstDefined(firstValue(offer.name), ""),
    url: firstDefined(firstValue(offer.url), ""),
    price: firstDefined(firstValue(offer.price), ""),
    currencyId: firstDefined(firstValue(offer.currencyId), ""),
    categoryId: firstDefined(firstValue(offer.categoryId), ""),
    vendor: firstDefined(firstValue(offer.vendor), ""),
    description: firstDefined(firstValue(offer.description), ""),
  };

  addOptionalScalar(normalized, "oldprice", offer.oldprice);
  addOptionalScalar(normalized, "vendorCode", offer.vendorCode);
  addOptionalScalar(normalized, "barcode", offer.barcode);
  addOptionalScalar(normalized, "sales_notes", offer.sales_notes);
  addOptionalScalar(normalized, "delivery", offer.delivery);
  addOptionalScalar(normalized, "pickup", offer.pickup);

  const deliveryOptions = parseDeliveryOptions(offer["delivery-options"]);
  if (deliveryOptions.length > 0) normalized.deliveryOptions = deliveryOptions;

  const pickupOptions = parseDeliveryOptions(offer["pickup-options"]);
  if (pickupOptions.length > 0) normalized.pickupOptions = pickupOptions;

  const pictures = asArray(offer.picture);
  if (pictures.length > 0) normalized.pictures = pictures;

  const parameters = asArray(offer.param).map((parameter) => ({
    name: firstDefined(parameter["@_name"], parameter.name),
    value: firstDefined(parameter["#text"], parameter.value, null),
    unit: firstDefined(parameter["@_unit"], parameter.unit, null),
  }));
  if (parameters.length > 0) normalized.parameters = parameters;

  return normalized;
}

/**
 * Преобразует YML-каталог Яндекс Маркета в удобный JSON.
 *
 * `includeData` controls whether the parsed object is also returned under
 * `data` (v6-only structured output); defaults to `true` for direct callers
 * such as tests, while the `yml` strategy passes it explicitly based on
 * whether it was invoked from v5 or v6 (see `dataField` in strategies/index.ts).
 */
export function processYandexMarketYml(parsed: YmlCatalog, includeData = true): StrategyTextResult {
  try {
    const catalog = parsed.yml_catalog;
    const shop = catalog.shop;

    const currencies = asArray(shop.currencies?.currency).map((currency) => ({
      id: firstDefined(currency["@_id"], currency.id),
      rate: firstDefined(currency["@_rate"], currency.rate, "1"),
    }));

    const categories = asArray(shop.categories?.category).map((category) => ({
      id: firstDefined(category["@_id"], category.id),
      name: firstDefined(category["#text"], category.name, null),
      parentId: firstDefined(category["@_parentId"], category.parentId, null),
    }));

    const offers = asArray(shop.offers?.offer).map(normalizeOffer);
    const availability = offers.reduce<{ available: number; unavailable: number }>(
      (counts, offer) => {
        if (offer.available === true || offer.available === "true") counts.available += 1;
        if (offer.available === false || offer.available === "false") counts.unavailable += 1;
        return counts;
      },
      { available: 0, unavailable: 0 },
    );

    const result = {
      yandex_market_catalog: {
        shop_info: {
          name: firstDefined(firstValue(shop.name), "Unknown Shop"),
          company: firstDefined(firstValue(shop.company), ""),
          url: firstDefined(firstValue(shop.url), ""),
          platform: firstDefined(firstValue(shop.platform), ""),
          date: firstDefined(catalog["@_date"], catalog.date, ""),
        },
        currencies,
        categories,
        delivery_options: parseDeliveryOptions(shop["delivery-options"]),
        pickup_options: parseDeliveryOptions(shop["pickup-options"]),
        offers,
        statistics: {
          total_categories: categories.length,
          total_offers: offers.length,
          available_offers: availability.available,
          unavailable_offers: availability.unavailable,
        },
      },
    };

    return {
      text: JSON.stringify(result, null, 2),
      ...(includeData ? { data: result } : {}),
      warning: offers.length > 1000 ? `Большой каталог: ${offers.length} товаров` : undefined,
    };
  } catch (error) {
    throw new ProcessingError(
      `YML catalog processing error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
