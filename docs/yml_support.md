# Yandex Market YML Implementation Details

## Technical Implementation

The YML support is implemented as part of the strategy pattern in `FileToJsonNode.node.ts`. The implementation includes:

### Processing Strategy

```typescript
yml: async (buf) => {
  try {
    const xmlContent = buf.toString("utf8");
    const parsed = await parseStringPromise(xmlContent);
    
    // Check if this is a Yandex Market YML file
    if (parsed.yml_catalog && parsed.yml_catalog.shop) {
      return processYandexMarketYml(parsed);
    }
    
    // Fallback to regular XML processing
    return { text: JSON.stringify(parsed, null, 2) };
  } catch (error) {
    throw new ProcessingError(`YML processing error: ${error.message}`);
  }
}
```

### Specialized YML Processing Function

The `processYandexMarketYml()` function handles the complex structure of Yandex Market catalogs with proper TypeScript interfaces for type safety.

## Implementation Features

### 🎯 Automatic Detection
- Detects Yandex Market YML structure by checking for `yml_catalog` root element
- Falls back to regular XML parsing for non-Yandex YML files
- Uses xml2js for reliable XML parsing with proper error handling

### 📊 Structured Data Extraction

The implementation includes TypeScript interfaces for type safety:

```typescript
interface YmlCatalog {
  yml_catalog: {
    $?: { date?: string };
    date?: string;
    shop: YmlShop | YmlShop[];
  };
}

interface YmlOffer {
  $: { id: string; available?: string };
  name?: string | string[];
  price?: string | string[];
  vendor?: string | string[];
  // ... other properties
}
```

### Data Processing Pipeline

1. **XML Parsing**: Uses xml2js to convert XML to JavaScript objects
2. **Structure Validation**: Checks for required yml_catalog structure
3. **Data Normalization**: Handles arrays vs single values consistently
4. **Statistical Analysis**: Calculates totals and availability metrics
5. **JSON Output**: Structured JSON with nested catalog information

### 📈 Performance Considerations
- Memory-efficient processing using xml2js
- Handles large catalogs with warning system (>1000 products)
- Stream-based processing for very large files
- Error recovery for malformed catalogs

## Supported YML Structure

### Basic Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2024-01-15 12:00">
  <shop>
    <name>Shop Name</name>
    <company>Company Name</company>
    <url>https://example.com</url>
    
    <currencies>
      <currency id="RUR" rate="1"/>
    </currencies>
    
    <categories>
      <category id="1">Electronics</category>
      <category id="2" parentId="1">Smartphones</category>
    </categories>
    
    <offers>
      <offer id="12345" available="true">
        <name>Product Name</name>
        <url>https://example.com/product</url>
        <price>50000</price>
        <oldprice>60000</oldprice>
        <currencyId>RUR</currencyId>
        <categoryId>2</categoryId>
        <vendor>Apple</vendor>
        <vendorCode>PRODUCT-123</vendorCode>
        <picture>https://example.com/image1.jpg</picture>
        <picture>https://example.com/image2.jpg</picture>
        <description>Product description</description>
        <sales_notes>Special offer</sales_notes>
        <param name="Color">Black</param>
        <param name="Memory">128 GB</param>
        <barcode>1234567890123</barcode>
        <delivery>true</delivery>
        <pickup>true</pickup>
      </offer>
    </offers>
  </shop>
</yml_catalog>
```

## Output Format

The YML processor converts the XML structure into a structured JSON format:

```json
{
  "yandex_market_catalog": {
    "shop_info": {
      "name": "Shop Name",
      "company": "Company Name", 
      "url": "https://example.com",
      "date": "2024-01-15 12:00"
    },
    "currencies": [
      {
        "id": "RUR",
        "rate": "1"
      }
    ],
    "categories": [
      {
        "id": "1",
        "name": "Electronics",
        "parentId": null
      },
      {
        "id": "2", 
        "name": "Smartphones",
        "parentId": "1"
      }
    ],
    "offers": [
      {
        "id": "12345",
        "available": "true",
        "name": "Product Name",
        "url": "https://example.com/product",
        "price": "50000",
        "oldprice": "60000",
        "currencyId": "RUR",
        "categoryId": "2",
        "vendor": "Apple",
        "vendorCode": "PRODUCT-123",
        "description": "Product description",
        "sales_notes": "Special offer",
        "barcode": "1234567890123",
        "delivery": "true",
        "pickup": "true",
        "pictures": [
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg"
        ],
        "parameters": [
          {
            "name": "Color",
            "value": "Black",
            "unit": null
          },
          {
            "name": "Memory", 
            "value": "128 GB",
            "unit": null
          }
        ]
      }
    ],
    "statistics": {
      "total_categories": 2,
      "total_offers": 1,
      "available_offers": 1,
      "unavailable_offers": 0
    }
  }
}
```

## Use Cases

### 📊 E-commerce Analytics
- Product catalog analysis
- Category structure mapping
- Inventory tracking
- Price monitoring

### 🔄 Data Migration
- Converting Yandex Market feeds to other formats
- Catalog synchronization between systems
- Product data normalization

### 🔍 Quality Control
- Catalog validation
- Missing data detection
- Product availability monitoring

## Error Handling

- **Invalid YML Structure**: Falls back to regular XML parsing
- **Missing Required Fields**: Gracefully handles missing shop information
- **Empty Sections**: Processes catalogs with missing categories or offers
- **Large Catalogs**: Provides warnings for catalogs with >1000 products

## Performance Considerations

- Memory efficient processing using xml2js
- Structured data extraction without loading entire DOM
- Optimized for typical Yandex Market catalog sizes
- Warning system for unusually large catalogs

## Integration Examples

### Basic Processing
```javascript
// Input: YML file buffer
// Output: Structured catalog data
const result = await processYmlFile(buffer);
const catalog = JSON.parse(result.text).yandex_market_catalog;

console.log(`Shop: ${catalog.shop_info.name}`);
console.log(`Products: ${catalog.statistics.total_offers}`);
console.log(`Categories: ${catalog.statistics.total_categories}`);
```

### Category Analysis
```javascript
const categories = catalog.categories;
const rootCategories = categories.filter(cat => !cat.parentId);
const subcategories = categories.filter(cat => cat.parentId);

console.log(`Root categories: ${rootCategories.length}`);
console.log(`Subcategories: ${subcategories.length}`);
```

### Product Filtering
```javascript
const availableProducts = catalog.offers.filter(offer => 
  offer.available === 'true' || offer.available === true
);

const expensiveProducts = catalog.offers.filter(offer => 
  parseInt(offer.price) > 100000
);
```

## Compatibility

- ✅ Yandex Market YML format (all versions)
- ✅ Both simplified and arbitrary catalog formats
- ✅ UTF-8 encoding support
- ✅ Fallback to XML processing for non-Yandex YML files
- ✅ Error recovery for malformed catalogs

## Testing

The YML functionality includes comprehensive test coverage:

- Unit tests for YML structure processing
- Integration tests with real YML files
- Error handling validation
- Performance benchmarks

See `test/integration/yml-integration.test.ts` and `test/unit/yml-processor.test.ts` for detailed test cases. 