/**
 * Общие типы и интерфейсы проекта
 */

export interface FileMetadata {
  fileName: string | null;
  fileSize: number;
  fileType: string;
  processedAt: string;
}

export interface StrategyTextResult {
  text: string;
  warning?: string;
}

export interface StrategySheetResult {
  sheets: Record<string, unknown[]>;
  warning?: string;
}

export type StrategyResult = StrategyTextResult | StrategySheetResult;
export type JsonTextResult = StrategyTextResult & { metadata: FileMetadata };
export type JsonSheetResult = StrategySheetResult & { metadata: FileMetadata };
export type JsonResult = JsonTextResult | JsonSheetResult;

export type DocxOutputFormat = 'text' | 'html' | 'markdown';

export type StrategyFn = (
  buf: Buffer,
  ext?: string,
  options?: { outputFormat?: DocxOutputFormat }
) => Promise<StrategyResult>;

// YML (Yandex Market) типы
export type YmlScalar = string | number | boolean;

export interface YmlDeliveryOption {
  "@_cost"?: YmlScalar;
  "@_days"?: YmlScalar;
  "@_order-before"?: YmlScalar;
  cost?: YmlScalar;
  days?: YmlScalar;
  "order-before"?: YmlScalar;
}

export interface YmlCurrency {
  "@_id"?: YmlScalar;
  "@_rate"?: YmlScalar;
  id?: YmlScalar;
  rate?: YmlScalar;
}

export interface YmlCategory {
  "@_id"?: YmlScalar;
  "@_parentId"?: YmlScalar;
  "#text"?: YmlScalar;
  id?: YmlScalar;
  name?: YmlScalar;
  parentId?: YmlScalar;
}

export interface YmlOffer {
  "@_id"?: YmlScalar;
  "@_available"?: YmlScalar;
  id?: YmlScalar;
  available?: YmlScalar;
  name?: YmlScalar | YmlScalar[];
  url?: YmlScalar | YmlScalar[];
  price?: YmlScalar | YmlScalar[];
  currencyId?: YmlScalar | YmlScalar[];
  categoryId?: YmlScalar | YmlScalar[];
  vendor?: YmlScalar | YmlScalar[];
  description?: YmlScalar | YmlScalar[];
  oldprice?: YmlScalar | YmlScalar[];
  vendorCode?: YmlScalar | YmlScalar[];
  barcode?: YmlScalar | YmlScalar[];
  sales_notes?: YmlScalar | YmlScalar[];
  delivery?: YmlScalar | YmlScalar[];
  pickup?: YmlScalar | YmlScalar[];
  "delivery-options"?: { option: YmlDeliveryOption | YmlDeliveryOption[] };
  "pickup-options"?: { option: YmlDeliveryOption | YmlDeliveryOption[] };
  picture?: YmlScalar | YmlScalar[];
  param?: Array<{ "@_name": YmlScalar; "@_unit"?: YmlScalar; "#text"?: YmlScalar; name?: YmlScalar; value?: YmlScalar; unit?: YmlScalar }>;
}

export interface YmlShop {
  name?: YmlScalar | YmlScalar[];
  company?: YmlScalar | YmlScalar[];
  url?: YmlScalar | YmlScalar[];
  platform?: YmlScalar | YmlScalar[];
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
