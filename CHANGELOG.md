# Changelog

## [1.0.12] - 2025-10-09

### 🐛 Bug Fixes & Improvements
- **Error Diagnostics**: Dramatically improved error message for EmptyFileError
  - Now shows file name, format, and size in error message
  - Lists 4 possible reasons why file might appear empty
  - Provides actionable recommendations for fixing the issue
  - Example: `File "doc.docx" (DOCX, 916.02 KB) contains no extractable text. Possible reasons: (1) File contains only images...`
  
- **DOCX Parser**: Enhanced error reporting for DOCX processing
  - Now reports failures from both primary (officeparser) and fallback (mammoth) parsers
  - Explicit handling of empty text results from parsers
  - Better debugging information for troubleshooting

### 📚 Documentation
- **TROUBLESHOOTING_EMPTY_FILE.md**: Complete guide for diagnosing empty file errors
  - 5 common reasons for empty file errors with solutions
  - Step-by-step diagnostic procedures
  - Alternative tools and manual extraction methods
  - Quick fix recipes for most common cases
  
- **FIX_EMPTY_FILE_ERROR.md**: Update instructions and changelog details
  - Multiple installation/update methods documented
  - Testing procedures for verification
  - Known issues vs actual bugs clarification

### 🎯 Impact
- **User Experience**: Users now understand why processing failed and how to fix it
- **Developer Experience**: Easier to diagnose parser issues with detailed error messages
- **Support Reduction**: Self-service troubleshooting reduces support requests

### 🔧 Technical Details
- Modified `strategies.docx` to explicitly handle empty strings
- Enhanced `EmptyFileError` throw location with contextual information
- No breaking changes - purely diagnostic improvements

---

## [1.0.11.1] - 2025-01-27

### 🔧 Bug Fixes
- **GitHub Actions**: Fixed permissions error in release workflow
  - Added `checks: write` permission to release.yml
  - Resolves workflow error when calling ci.yml from release.yml
- **Code Quality**: Fixed all TypeScript linter errors (18 issues)
  - Replaced `any` types with proper interfaces for YML processing
  - Added type-safe interfaces: YmlCurrency, YmlCategory, YmlOffer, YmlShop, YmlCatalog
  - Fixed `require()` import in integration tests
  - Added eslint-disable comments for test files where needed
- **Build**: All tests passing (60/60) and linter clean

### 📝 Technical Details
- Enhanced type safety for YML processing functions
- Improved code maintainability and IDE support
- No functional changes - purely technical improvements

---

## [1.0.11] - 2025-01-27

### ✨ New Features
- **YML Support**: Added comprehensive support for YML file format
  - Specialized processing for Yandex Market catalog files (yml_catalog format)
  - Structured JSON output with sections: shop_info, currencies, categories, offers, statistics
  - Automatic detection of Yandex Market YML structure
  - Fallback to standard XML processing for regular YML files
  - Support for product parameters, images, delivery options
  - Performance optimized for typical catalog sizes with warnings for large datasets

### 📄 Technical Implementation
- Added `processYandexMarketYml` function for specialized YML processing
- Enhanced file type detection and processing strategies
- Comprehensive test coverage with integration and unit tests
- Updated documentation with YML examples and usage guidelines

### 📁 Files Added/Modified
- `src/FileToJsonNode.node.ts`: Added YML processing strategy
- `test/samples/sample_yandex_market.yml`: Sample YML test file
- `test/integration/yml-integration.test.ts`: Integration tests
- `test/unit/yml-processor.test.ts`: Unit tests
- `docs/yml_support.md`: Comprehensive YML documentation
- `README.md`: Updated with YML support information

### 🎯 Impact
- Users can now process Yandex Market catalog files with structured output
- Enhanced data extraction capabilities for e-commerce integrations
- Backward compatible - no breaking changes

---

## [1.0.10] - 2025-06-20

### 🐛 Bug Fixes
- **Critical**: Fixed support for ODT, ODP, ODS, and JSON file formats
  - Added missing format extensions to supported formats list
  - Resolves "Unsupported file type" error for these formats
  - Format processing strategies were already implemented but not accessible

### 📋 Technical Details
- Added `odt`, `odp`, `ods`, `json` to the `supported` array in FileToJsonNode
- All format handlers were previously implemented in the `strategies` object
- This was a configuration oversight that prevented format recognition

### 🔧 Files Changed
- `src/FileToJsonNode.node.ts`: Updated supported formats array

### 🎯 Impact
- Users can now successfully process OpenDocument formats (ODT, ODP, ODS)
- JSON files are now properly recognized and processed
- No breaking changes - purely additive fix

---

## [1.0.9] - 2025-06-20

### 🐛 Bug Fixes
- **CI/CD**: Fixed Jest parameter compatibility issues
  - Updated `--testPathPattern` to `--testPathPatterns` in all CI commands
  - Resolves Jest 30+ compatibility problems
  - All CI tests now pass successfully

### 🔧 Files Changed
- `.github/workflows/ci.yml`: Updated Jest command parameters

---

## Previous Versions

For changes in versions 1.0.8 and earlier, please see the [GitHub releases page](https://github.com/mazixs/n8n-node-converter-documents/releases). 