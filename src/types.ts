/**
 * Общие типы и интерфейсы проекта
 */

export interface JsonTextResult {
  text: string;
  warning?: string;
  metadata: Record<string, unknown>;
}

export interface JsonSheetResult {
  sheets: Record<string, unknown>;
  warning?: string;
  metadata: Record<string, unknown>;
}

export type JsonResult = JsonTextResult | JsonSheetResult;

export type StrategyFn = (
  buf: Buffer,
  ext?: string,
  options?: { outputFormat?: string }
) => Promise<Partial<JsonResult>>;

// YML (Yandex Market) типы
export interface YmlDeliveryOption {
  "@_cost"?: string;
  "@_days"?: string;
  "@_order-before"?: string;
  cost?: string;
  days?: string;
  "order-before"?: string;
}

export interface YmlCurrency {
  "@_id"?: string;
  "@_rate"?: string;
  id?: string;
  rate?: string;
}

export interface YmlCategory {
  "@_id"?: string;
  "@_parentId"?: string;
  "#text"?: string;
  id?: string;
  name?: string;
  parentId?: string;
}

export interface YmlOffer {
  "@_id"?: string;
  "@_available"?: string;
  id?: string;
  available?: string;
  name?: string | string[];
  url?: string | string[];
  price?: string | string[];
  currencyId?: string | string[];
  categoryId?: string | string[];
  vendor?: string | string[];
  description?: string | string[];
  oldprice?: string | string[];
  vendorCode?: string | string[];
  barcode?: string | string[];
  sales_notes?: string | string[];
  delivery?: string | string[];
  pickup?: string | string[];
  "delivery-options"?: { option: YmlDeliveryOption | YmlDeliveryOption[] };
  "pickup-options"?: { option: YmlDeliveryOption | YmlDeliveryOption[] };
  picture?: string | string[];
  param?: Array<{ "@_name": string; "@_unit"?: string; "#text"?: string; name?: string; value?: string; unit?: string }>;
}

export interface YmlShop {
  name?: string | string[];
  company?: string | string[];
  url?: string | string[];
  platform?: string | string[];
  currencies?: { currency: YmlCurrency | YmlCurrency[] };
  categories?: { category: YmlCategory | YmlCategory[] };
  offers?: { offer: YmlOffer | YmlOffer[] };
  "delivery-options"?: { option: YmlDeliveryOption | YmlDeliveryOption[] };
  "pickup-options"?: { option: YmlDeliveryOption | YmlDeliveryOption[] };
}

export interface YmlCatalog {
  yml_catalog: {
    "@_date"?: string;
    date?: string;
    shop: YmlShop;
  };
}
