# Changelog

## [1.0.20] - 2025-10-10

### 🚀 New Features
- **TextBox & Shapes Support**: Added extraction of text from TextBoxes and shapes
  - Now extracts text from `<a:t>` tags (DrawingML text elements)
  - Supports `wps:` namespace (Word Processing Shapes - TextBox, shapes)
  - Handles complex documents with mixed content (text + images + shapes)

### 🐛 Bug Fix
- **ONLYOFFICE Documents**: Fixed text extraction from documents with embedded shapes
  - Previously: Text in TextBoxes was ignored
  - Now: Extracts ALL text including TextBoxes, shapes, and regular paragraphs
  - User hypothesis confirmed: Images + text documents now work correctly

### 🧪 Testing
- **Added**: Test for TextBox extraction (`text-in-textbox.docx`)
- **Added**: Test for mixed content documents (`text-with-image.docx`)
- **Result**: All 62 tests passing (was 61)
- **Coverage**: Regular text, TextBox text, DrawingML text

### 📊 Supported Text Sources
1. `<w:t>` - Regular paragraph text
2. `<a:t>` - DrawingML text (shapes, diagrams)
3. `<wps:txbx>` → `<w:t>` - TextBox content
4. Mixed documents with images + text

### 📋 Files Changed
- `src/FileToJsonNode.node.ts`: Added `wps:` prefix support, `a:t` tag extraction
- `test/integration/onlyoffice-docx.test.ts`: Added TextBox test
- `test/samples/text-in-textbox.docx`: New test file
- `test/samples/text-with-image.docx`: New test file

### 🎯 Impact
- **For Users**: Documents with TextBoxes and shapes now extract ALL text content
- **For ONLYOFFICE Users**: Complex documents with mixed content now work correctly
- **Performance**: No impact - same recursive traversal, just more namespaces

---

## [1.0.19] - 2025-10-10

### 🐛 Critical Bug Fix
- **ONLYOFFICE DOCX Parser**: Fixed XML namespace extraction bug
  - **Problem**: Fallback parser extracted ALL string values from XML, including:
    - `xmlns` attributes (`http://schemas.microsoft.com/office/word/...`)
    - XML namespace URIs instead of actual text
    - User reported seeing schemas instead of document text
  - **Solution**: Enhanced extraction logic to target ONLY `<w:t>` tag content
    - Added `isInsideTextNode` flag to track context
    - Stops traversing after finding `w:t` tags
    - Filters out XML attributes (starting with `$` or `rsid*`)
    - Only traverses Word structural elements (`w:*`)

### 🧪 Testing
- **Added**: `test/integration/onlyoffice-docx.test.ts` - Specific test for ONLYOFFICE parsing
- **Added**: `test/samples/onlyoffice-text.docx` - Test file with actual text
- **Result**: All 61 tests passing (was 60)
- **Verification**: No XML namespaces in extracted text ✅

### 📊 Before vs After

**Before (v1.0.16-1.0.18):**
```
Extracted: "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas 
http://schemas.microsoft.com/office/drawing/2014/chartex..."
```

**After (v1.0.19):**
```
Extracted: "Привет из ONLYOFFICE! Это тестовый документ для проверки парсинга."
```

### 📋 Files Changed
- `src/FileToJsonNode.node.ts`: Fixed `extractText` function with context-aware parsing
- `test/integration/onlyoffice-docx.test.ts`: New integration test
- `test/samples/onlyoffice-text.docx`: New test file with text content

### 🎯 Impact
- **For Users**: ONLYOFFICE and other non-standard DOCX files now extract clean text
- **For Developers**: Robust fallback parser for edge cases

### ℹ️ Note
File `onlyoffice1.docx` (938 KB) contains only an image, no text. This is not a bug - 
the file genuinely has no `<w:t>` tags. Parser correctly returns empty text for such files.

---

## [1.0.18] - 2025-10-10

### 🔒 Security & CI/CD
- **CRITICAL: Fixed CI/CD Pipeline Architecture**
  - Release workflow now depends on successful CI completion
  - Added `needs: ci` to release job - release cannot start if CI fails
  - Release now calls CI workflow via `workflow_call` to ensure checks run
  - Prevents publishing broken releases from commits that didn't pass CI
  - Removed duplicate lint/build/test steps from release workflow

### 🏗️ Architecture Changes
**Before (❌ UNSAFE):**
```
Tag created → Release runs independently → Could publish broken code
```

**After (✅ SAFE):**
```
Tag created → CI runs (lint/build/test) → [PASS] → Release publishes
                                        ↓
                                     [FAIL] → Release blocked
```

### 📋 Files Changed
- `.github/workflows/release.yml`: 
  - Added CI job that calls ci.yml workflow
  - Added `needs: ci` dependency to release job
  - Removed duplicate lint/test steps (now handled by CI)
  - Added `checks: write` permission

### 🎯 Impact
- **For Security**: Cannot accidentally publish broken code
- **For CI/CD**: Follows proper gate-keeper pattern
- **For Developers**: Release failures now clearly show CI step that failed
- **Build Time**: No change - steps still run, but in correct order

### ⚠️ Breaking Change Note
This is a CI/CD architecture fix, not a code change. No breaking changes for users.

---

## [1.0.17] - 2025-10-10

### 🔧 Code Quality
- **ESLint Fixes**: Fixed all linter errors and warnings
  - Removed unused `error` and `zipError` variables in catch blocks
  - Fixed `any` type usage with proper type assertions and eslint-disable comments
  - Removed unused function parameters (`_sheetId`, `_rowNumber`)
  - Cleaned up unused eslint-disable directive in test/setup.ts
  
- **CI/CD**: Added lint step to release workflow
  - Release workflow now runs: Lint → Build → Test before publishing
  - Prevents releases with code quality issues
  - CI workflow already had lint step

### 📋 Files Changed
- `src/FileToJsonNode.node.ts`: Fixed 6 eslint errors
- `test/setup.ts`: Removed 1 eslint warning
- `.github/workflows/release.yml`: Added lint step

### 🎯 Impact
- **For Developers**: Code quality gates ensure clean releases
- **For CI/CD**: No more releases with linter errors

---

## [1.0.16] - 2025-10-10

### 🚀 Features
- **DOCX Parser Enhancement**: Added third-level fallback parser for non-standard DOCX files
  - Now supports DOCX files created in ONLYOFFICE and other non-Microsoft applications
  - Implements direct XML parsing from DOCX ZIP structure when standard parsers fail
  - Three-tier parsing strategy: officeparser → mammoth → direct XML extraction
  - Extracts text from `<w:t>` tags in word/document.xml

### 🐛 Bug Fixes
- **ONLYOFFICE Compatibility**: Fixed "no extractable text" error for ONLYOFFICE-created DOCX files
  - Previously both officeparser and mammoth returned empty strings
  - Now successfully extracts text using direct ZIP/XML parsing
  - Maintains backward compatibility with standard Microsoft DOCX files

### 📦 Dependencies
- **Added**: `jszip@^3.10.1` - ZIP archive manipulation for DOCX parsing
- **Added**: `@types/jszip@^3.4.1` (dev) - TypeScript definitions

### 🔧 Technical Details
- Enhanced DOCX strategy with recursive XML text extraction
- Parser tries methods sequentially, returns first successful result
- Only throws error if all three methods fail
- Improved error message for truly corrupted/encrypted files

### 📋 Files Changed
- `src/FileToJsonNode.node.ts`: Enhanced DOCX processing with JSZip fallback
- `package.json`: Added jszip dependency

### 🎯 Impact
- **For Users**: ONLYOFFICE and other alternative office suite files now work correctly
- **For Developers**: More robust DOCX handling with graceful fallbacks
- **Performance**: No impact - fallback only used when standard parsers fail

---

## [1.0.15] - 2025-10-10

### 🐛 Bug Fixes
- **Error Messages**: Fixed hardcoded file size limit in error message
  - `FileTooLargeError` now displays actual configured limit instead of always showing "50 MB"
  - Users can set custom limits up to 100 MB in node settings
  - Error message now dynamically shows: `"File is too large (maximum XX MB)"` where XX is the configured value
  - Example: If limit set to 80 MB, error will show "maximum 80 MB" instead of "maximum 50 MB"

### 🔧 Technical Details
- Modified error throw statement in line 735 to use dynamic `maxFileSize` parameter
- No functional changes to size validation logic - it already worked correctly
- Purely cosmetic fix to improve user experience and clarity

### 📋 Files Changed
- `src/FileToJsonNode.node.ts`: Updated FileTooLargeError message to be dynamic

---

## [1.0.14] - 2025-10-10

### 🐛 Critical Bug Fixes
- **Error Handling**: Fixed major error propagation issues
  - Removed double-wrapping of errors that caused message duplication
  - Specialized error types (`UnsupportedFormatError`, `EmptyFileError`, etc.) now properly preserved
  - Enhanced error context in PDF fallback parser to show both primary and fallback failures
  - Added consistent error type checking in ODT/ODP/ODS strategies
  - Example fix: Previously showed `"ProcessingError: DOCX processing error: DOCX processing error..."`, now shows proper specialized errors

- **Excel Processing**: Eliminated anti-pattern in XLSX strategy
  - Removed exception-based control flow (throwing error to trigger fallback)
  - Direct ExcelJS usage for better performance and cleaner code
  - No functional changes, purely architectural improvement

- **TypeScript Compatibility**: Fixed import errors
  - Corrected `NodeConnectionType` → `NodeConnectionTypes` import from n8n-workflow
  - Resolved TypeScript linter errors about types used as values

### 🔒 Security
- **Dependencies**: Fixed critical vulnerability in `form-data`
  - Added `overrides` section to force `form-data@>=4.0.4` 
  - Resolves GHSA-fjxv-7rqg-78g4 (unsafe random boundary generation)
  - Zero breaking changes - uses npm overrides feature

### 📚 Documentation
- **Error Handling Analysis**: Added comprehensive documentation
  - Created `docs/error-handling-issues.md` with detailed problem analysis
  - Documented all 5 identified issues with before/after code examples
  - Included testing results and impact assessment

### ✅ Testing & Quality
- All 60 tests passing
- ESLint clean (0 errors, 1 pre-existing warning)
- TypeScript compilation successful
- Zero security vulnerabilities after fixes

### 🎯 Impact
- **For Users**: Clear, non-duplicated error messages with proper error types
- **For Developers**: Cleaner codebase, better error handling patterns, improved type safety
- **Performance**: Eliminated unnecessary try-catch overhead in Excel processing

### 🔧 Technical Details
- Modified error catching logic in main execute method (lines 772-783)
- Refactored XLSX strategy to remove control-flow exceptions (lines 478-499)
- Enhanced PDF fallback to capture both error contexts (lines 508-524)
- Added error type preservation in ODT/ODP/ODS handlers (lines 444-476)
- Fixed n8n-workflow import to use value-level exports

---

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