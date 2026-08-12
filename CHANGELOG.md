# Changelog

## [1.4.1] - 2026-08-12

### Fixed

- Restored the n8n node-loader contract by exporting `ConvertFileToJson` from `dist/ConvertFileToJson.node.js`, while retaining `FileToJsonNode` as a backwards-compatible alias.

### Tests

- Added a regression test that verifies the compiled node entry point exports the class name derived by n8n from the file name.

## [1.4.0] - 2026-07-15

### Added

- Added node version 6 with one ordered output item per input, preserved `item.json`, `pairedItem`, optional source binary retention, and structured `Continue On Fail` results.
- Added the explicit `validate → detect → check limits → parse → OCR decision → normalize → emit` state machine.
- Added configurable file, row, text, output, concurrency, and Office ZIP-container limits.
- Added optional local OCR for scanned PDFs through dynamically loaded `tesseract.js` and `pdf-to-img`, including languages, model/cache paths, page limits, timeouts, concurrency, metadata, and guaranteed cleanup.
- Added ZIP traversal, entry-count, expanded-size, and per-entry/archive compression-ratio validation.

### Changed

- Updated compatible production and development dependencies; pinned TypeScript 5.9 and the latest CommonJS-compatible `read-excel-file` 8 release.
- Raised the compilation target to ES2022 and retained Node.js `>=22.22.0`; CI now covers Node.js 22.22 and 24 with current GitHub Actions runtimes.
- JSON preserves nested structure by default in version 6, with flattening available explicitly.
- Replaced the stale README with installation, version 5 migration, OCR, limits, troubleshooting, security, and release guidance.

### Security

- File signatures are checked even when the extension is supported, with mismatches reported to the workflow.
- OCR paths and numerical controls are validated before loading optional modules; remote model locations require credential-free HTTPS.
- `npm audit` reports no known vulnerabilities in either the production or complete dependency tree at release preparation time.

### Tests

- Added FSM, mixed-result, ordering, archive, configurable parser, OCR timeout, cleanup, language, and concurrency coverage.
- Raised global coverage gates to 80% statements/lines, 60% branches, and 85% functions, with stricter gates for FSM, archive, and OCR modules.
- Added a gated real OCR smoke test while keeping regular CI deterministic with mocks.

## [1.3.1] - 2026-07-15

### Changed

- Raised the minimum Node.js version to 22.22.0 to match the current n8n node-development baseline.
- Excluded local package archives, tool caches, browser-test reports, temporary directories, and agent state from Git and npm packages.
- Added `.nvmrc` for consistent local Node.js selection.

## [1.3.0] - 2026-07-15

### Changed

- Reworked the conversion pipeline into an explicit validation, detection, processing, result-validation, metadata, and completion sequence.
- Replaced recursive promise scheduling with a bounded worker pool that preserves input order and validates concurrency.
- Unified OfficeParser strategies and made the strategy registry the single source of truth for supported formats.
- Standardized text decoding through `TextDecoder` for TXT, CSV, JSON, XML, YML, and HTML.
- Removed the unused Excel row limiter and redundant strategy wrappers.

### Fixed

- CSV truncation warnings now appear only when a row beyond the 100,000-row limit is present.
- Yandex Market YML conversion preserves numeric `0` and boolean `false` values.
- HTML fragments without a `<body>` element retain their text.
- Invalid or empty strategy results no longer reach the completed state.
- Aggregate n8n output now retains source-item pairing metadata.

### Security

- Updated `fast-xml-parser`, `file-type`, OfficeParser, and transitive dependencies; `npm audit` reports no known vulnerabilities.

### Tests

- Expanded the suite from 67 to 77 tests across 17 suites.
- Increased line coverage from 73.96% to 87.24% and strategy coverage from 49.24% to 80.53%.
- Added real-process compatibility checks for PDF, DOCX TextBox extraction, and CommonJS/ESM interoperation.

## [1.2.3] - 2026-07-12

### Fixed

- **PDF worker compatibility**: pinned `officeparser` to `6.0.4` instead of the floating `^6.0.4` range.
  - Prevents clean installations from resolving OfficeParser 6.1.x with a different `pdfjs-dist` API/worker combination.
  - Fixes PDF processing failures reporting mismatched PDF.js API and worker versions.

### Tests

- Added a dependency regression test that rejects floating `officeparser` versions.
- Added a real-file PDF extraction test executed in a normal Node.js process.

## [1.2.2] - 2026-02-14

### Tests

- **Test Architecture Refactoring**: Tests now exercise real `src/` code instead of local re-implementations.
  - `strategies.test.ts` — imports and tests actual `strategies` from `src/strategies/index.ts` (json, xml, html, pdf, doc, odt).
  - `processHtml.test.ts` — replaced local `processHtml` copy with real `strategies.html`/`strategies.htm` calls.
  - New `FileToJsonNode.execute.test.ts` — unit test for the node's `execute()` pipeline with mocked `IExecuteFunctions` context (txt processing, docx outputFormat passthrough, file-type autodetect, UnsupportedFormatError, EmptyFileError).
- **Coverage Quality Gate**: Added `coverageThreshold` to `jest.config.js`:
  - Global: 35% statements / 25% branches / 35% functions.
  - `FileToJsonNode.node.ts`: 50% statements / 30% branches / 60% functions.
  - `strategies/index.ts`: 30% statements / 15% branches / 20% functions.

### Release

- Bumped package version to `1.2.2` in:
  - `package.json`
  - `package-lock.json` (root package entries)

## [1.2.1] - 2026-02-13

### Fixed

- **Format Detection Whitelist**: Added missing `yml` and `ppt` to `SUPPORTED_FORMATS`.
  - Prevents false `Unsupported file type` errors for valid YML/PPT inputs.
  - Keeps extension whitelist aligned with implemented strategies.

### Documentation

- **README sync with actual node parameters**:
  - Removed obsolete `CSV Delimiter` and `Max Excel Rows` parameters.
  - Updated concurrency parameter to `Max Concurrency` with default `4`.
  - Updated large file limitation text to reference `Max File Size` only.

### Release

- Bumped package version to `1.2.1` in:
  - `package.json`
  - `package-lock.json` (root package entries)

## [1.2.0] - 2026-02-08

### Major Refactoring

- **Code Decomposition**: The monolithic `FileToJsonNode.node.ts` (930 LOC) was split into a modular architecture:
  - `src/types.ts` — all interfaces and types (JsonResult, StrategyFn, YML types)
  - `src/utils/` — shared utilities (sanitize, promisePool, columns, flatten)
  - `src/processors/yml.ts` — Yandex Market YML processor
  - `src/strategies/index.ts` — format strategies
  - `src/FileToJsonNode.node.ts` — node class only (~220 LOC)

- **Code Deduplication**:
  - `odt`, `odp`, `ods` strategies merged into `odfStrategy()` (was 3 copies)
  - `doc`, `ppt` strategies merged into `cfbLegacyStrategy()` (was 2 copies)
  - Removed dead `processExcel` (replaced by `read-excel-file`)
  - Removed `_getFirst` duplicate (replaced by `getVal`)
  - Removed redundant CSV `if/else` branch (both sides called `streamCsvStrategy`)

- **Bug Fix**: `promisePool` now uses a `Set` instead of `Array` to avoid race conditions when removing finished promises

### New Features

- **DOCX → Markdown**: New `outputFormat: "markdown"` for DOCX files
  - Pipeline: `mammoth` → HTML → `node-html-markdown`
  - GFM tables, ATX headings, bold/italic, lists
  - Ideal for AI/LLM/RAG pipelines
  - Added dependency `node-html-markdown` (pure JS, zero extra deps)

### Dependencies

**Removed** (production):
- `exceljs` → replaced by `read-excel-file` (lighter, actively maintained)
- `sanitize-html` → no longer needed (using `body.textContent`)
- `jszip` → no longer needed (DOCX fallback removed)
- `jschardet` + `iconv-lite` → replaced with `chardet` (builtin types, native Buffer.toString)

**Removed** (dev):
- `@babel/core`, `@babel/preset-env`, `babel-loader` (webpack dropped)
- `buffer`, `path-browserify`, `stream-browserify`, `util` (webpack polyfills)
- `@types/iconv-lite`, `@types/jszip`, `@types/sanitize-html` (types for removed deps)
- `audit-ci`, `webpack`, `webpack-cli`

**Added**:
- `chardet@^2.1.1` — encoding detection
- `read-excel-file@^6.0.3` — XLSX parsing

**Updated**:
- `mammoth` → `^1.11.0`
- `officeparser` → `^6.0.4`
- `fast-xml-parser` → `^5.3.4`
- `node-html-parser` → `^7.0.2`
- `n8n-workflow` → `^2.7.0` (aligned with n8n 2.7.0)
- `@types/papaparse` → `^5.5.2`

### Config & Build

- **tsconfig.json**: trimmed ~100 lines of commented defaults
- **package.json**:
  - Added `files` whitelist for precise npm packages
  - Removed `overrides.form-data` (was needed only for exceljs)
  - Removed `bundle`, `bundle:watch`, `standalone` scripts
  - Added `usableAsTool: true` to node description
- **.npmignore**: removed references to deleted files, added `AUDIT_AND_REFACTORING_PLAN.md`
- **Deleted files**: `webpack.config.js`, `create-standalone.js`, `standalone/`

### Tests & CI

- Updated unit tests to match the modular structure
- Removed `exceljs` and `sanitize-html` mocks
- Added `npm audit --omit=dev --audit-level=high` to CI pipeline

### Metrics

| Metric | Before (1.1.2) | After (1.2.0) |
|--------|----------------|---------------|
| FileToJsonNode.node.ts | 930 LOC | ~220 LOC |
| Production deps | 11 | 9 |
| Dev deps | 25 | 12 |
| Code duplication | 5 spots | 0 |
| Modules in `src/` | 4 files | 9 files (4 dirs) |

---

## [1.1.2] - 2025-11-29

### Bug Fixes

- **TypeScript Fixes**: Corrected `file-type` import for v16.5.4 CommonJS compatibility
- **ESLint Fixes**: Removed unused variables and `any` warnings
- **Build Fix**: Updated `limitExcelSheet` signature (added required `maxRows` argument)

### CI/CD Improvements

- **Auto Release**: Simplified workflow triggered on version bumps
- **npm Publish**: Automatic publishing to npmjs when version changes

## [1.1.0] - 2025-11-29

### New Features & Improvements

- **Preserve Tables**: New option to keep HTML tables/structure when converting DOCX/HTML (critical for RAG/LLM)
- **Metadata Extraction**: Author / Date / Title extraction for DOCX, XLSX, PPTX
- **CSV Control**: Manual **CSV Delimiter** (Auto, Comma, Semicolon, Tab, Pipe)
- **Scalability**: **Max Excel Rows** parameter (0 = unlimited) to prevent OOM
- **Scanned PDF Detection**: Warnings for suspected scanned/image PDFs

### Performance & Optimization

- **10x faster XML/YML**: Switched from `xml2js` to `fast-xml-parser`
- **Lower memory**:
  - Replaced `cheerio` with `node-html-parser`
  - Removed `pdf-parse` duplicate
- **Reliability**:
  - Refactored Promise Pool (isolated errors)
  - Upgraded `chardet` → `jschardet`
  - Fixed `file-type` build compatibility

## [1.0.22] - 2025-10-10

### UI & Branding

- **Node Renamed**: "Convert File to JSON" → **"Document Converter"**
  - Better reflects actual functionality (text, HTML, sheets)
  - More intuitive for users
  - Updated default display name

### Code Quality & Refactoring

**FileToJsonNode.node.ts** (-78 LOC):
- **Removed CFB duplication** via `checkCFBFormat()` helper (DOC/PPT)
- **Unified error handling** via `processViaOfficeParser()` for ODT/ODP/ODS
- **Fixed PPTX error handling**
- **Cleaner code** with 78 lines removed

**errors.ts** (Base class):
- Added `BaseConverterError`
- Improved stack traces via `Error.captureStackTrace`
- Full JSDoc coverage

**helpers.ts** (Docs):
- Added full JSDoc
- Added examples
- Better IntelliSense

**icon.svg**:
- Resized from 2048×1853 → 60×60 (n8n standard)
- Improved visibility

### Documentation

**README.md** (Full redesign):
- Added badges (npm, tests, license, TypeScript)
- Added ToC and visual tables
- Added XLSX section and collapsible examples
- Updated stats (80 tests)

### Testing

- 80 tests passing (+7 XLSX tests)
- New file: `test/integration/xlsx-sheets.test.ts`
  - Multi-sheet handling, column letters, row limits, sparse data, output verification

### Code Quality Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Code duplication** | 3 places | 0 | 100% removed |
| **Lines of code** | 920 | 870 | 50 lines |
| **Error handling coverage** | Partial | 100% | PPTX fixed |
| **Documentation** | Basic | Full JSDoc | Complete |
| **Test coverage** | 73 tests | 80 tests | +7 |

### Impact

- **Users**: Better naming, proper icon sizing
- **Developers**: Cleaner codebase, easier maintenance
- **Docs**: Professional README
- **Quality**: Zero duplication, full error handling

### Files Changed

- `package.json`: Version bump to 1.0.22
- `src/FileToJsonNode.node.ts`: -78 lines, +2 helpers
- `src/errors.ts`: Added BaseConverterError
- `src/helpers.ts`: Full JSDoc
- `src/icon.svg`: Fixed dimensions
- `README.md`: Complete redesign
- `test/integration/xlsx-sheets.test.ts`: +7 tests
- `docs/README.md`: Updated node name
- `docs/HTML_CONVERSION_PLAN.md`: Updated node name

---

## [1.0.21] - 2025-10-10

### Major Feature: DOCX to HTML Conversion
### 🚀 Major Feature: DOCX to HTML Conversion

- **NEW: Output Format Parameter** for DOCX files
  - Added `outputFormat` parameter with options: `text` (default) | `html`
  - HTML mode preserves tables, formatting, and document structure
  - Text mode remains unchanged for backward compatibility
  
- **Table Support**: HTML format correctly converts DOCX tables
  - Tables preserved as `<table>`, `<tr>`, `<td>` elements
  - Table structure fully maintained (3 tables, 18 rows, 42 cells verified)
  - AI/LLM friendly - HTML understood by ChatGPT, Claude, and other models
  
- **Formatting Preservation**:
  - Bold text: `<strong>`
  - Italic text: `<em>`
  - Headings: `<h1>` - `<h6>`
  - Lists: `<ul>`, `<ol>`, `<li>`
  - Paragraphs: `<p>`

### 🔧 Implementation Details

- **mammoth.convertToHtml()** - Official recommended approach
  - Replaced deprecated `mammoth.convertToMarkdown()` (deprecated by library author)
  - Zero additional dependencies - uses existing mammoth library
  - Fallback mechanism: HTML → Text if HTML conversion fails
  
- **Research & Analysis**:
  - Investigated mammoth.js official documentation via MCP Exa
  - Discovered `convertToMarkdown` is deprecated and doesn't support tables
  - Author recommends HTML over Markdown for better results
  - Documented findings in `docs/MAMMOTH_ANALYSIS.md`

### 📊 Performance & Size

- **Plain Text**: 3,637 chars (fast, minimal)
- **HTML**: 57,852 chars (+1,591%) (structured, AI-friendly)
- **Bundle Size**: +0 KB (no new dependencies)
- **Processing Time**: +10-50ms for HTML mode (negligible)

### 🧪 Testing

- **73 tests passing** (+5 new tests)
- New test files:
  - `test/integration/docx-to-html.test.ts` - HTML conversion tests
  - `test/integration/docx-tables.test.ts` - Table structure analysis
  - `test/integration/docx-output-format.test.ts` - Output format parameter tests
- **Verified**: Tables extraction, formatting preservation, size comparison
- **ESLint**: Clean - replaced all `any` types with `unknown` for type safety

### 📚 Documentation

- `docs/MAMMOTH_ANALYSIS.md` - Complete mammoth.js research findings
- `docs/HTML_CONVERSION_PLAN.md` - Implementation plan and usage guide
- Updated with when to use HTML vs Plain Text recommendations

### 🎯 Use Cases

**Use HTML when:**
- Document contains tables (structure preserved)
- For AI/LLM processing (better context understanding)
- Formatting is important (bold, italic, headings)
- Lists and structure matter

**Use Plain Text when:**
- Simple text extraction
- Minimal output size needed (16x smaller)
- Maximum speed required
- Backward compatibility with existing workflows

### 🔄 Backward Compatibility

- ✅ Default is `text` mode - no breaking changes
- ✅ Existing workflows continue to work without modifications
- ✅ All previous extraction methods preserved
- ✅ Fallback mechanism ensures robustness

### 📋 Files Changed

- `src/FileToJsonNode.node.ts`: Added outputFormat parameter, updated DOCX strategy
- `test/integration/docx-to-html.test.ts`: HTML conversion tests
- `test/integration/docx-tables.test.ts`: Table extraction analysis
- `test/integration/docx-output-format.test.ts`: Parameter functionality tests
- `docs/MAMMOTH_ANALYSIS.md`: Research documentation
- `docs/HTML_CONVERSION_PLAN.md`: Implementation guide

### 🔧 Technical Architecture

```typescript
DOCX Strategy Flow:
1. If outputFormat === 'html':
   → mammoth.convertToHtml() 
   → [Success] Return HTML
   → [Fail] Fallback to text mode
   
2. Text mode (default):
   → officeparser (primary)
   → mammoth.extractRawText (fallback)
   → XML direct parsing (last resort)
```

### ⚠️ Notes

- `mammoth.convertToMarkdown()` was considered but found to be deprecated
- Tables don't work in Markdown mode (confirmed by library author)
- HTML chosen over Markdown for better AI compatibility and table support
- No additional dependencies required

---

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

### Security & CI/CD
- **CRITICAL: Fixed CI/CD Pipeline Architecture**
  - Release workflow now depends on successful CI completion
  - Added `needs: ci` to release job — release cannot start if CI fails
  - Release now calls CI workflow via `workflow_call` to ensure checks run
  - Prevents publishing broken releases from commits that didn't pass CI
  - Removed duplicate lint/build/test steps from release workflow

### Architecture Changes
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

### Files Changed
- `.github/workflows/release.yml`:
  - Added CI job that calls ci.yml workflow
  - Added `needs: ci` dependency to release job
  - Removed duplicate lint/test steps (now handled by CI)
  - Added `checks: write` permission

### Impact
- **Security**: Cannot accidentally publish broken code
- **CI/CD**: Proper gate-keeper pattern
- **Developers**: Release failures now clearly show the failing CI step
- **Build Time**: No change — steps still run, but in correct order

### Breaking Change Note
CI/CD architecture fix only. No breaking runtime changes.

---

## [1.0.17] - 2025-10-10

### Code Quality
- **ESLint Fixes**: Cleared all linter errors/warnings
  - Removed unused `error` and `zipError` variables
  - Replaced `any` with typed assertions or eslint-disable blocks
  - Removed unused parameters (`_sheetId`, `_rowNumber`)
  - Cleaned unused eslint-disable in `test/setup.ts`
 
- **CI/CD**: Added lint step to release workflow
  - Release now runs: Lint → Build → Test before publishing
  - Prevents releases with lint issues
  - CI workflow already had lint step

### Files Changed
- `src/FileToJsonNode.node.ts`: Fixed 6 ESLint errors
- `test/setup.ts`: Removed 1 ESLint warning
- `.github/workflows/release.yml`: Added lint step

### Impact
- **Developers**: Code quality gate ensures clean releases
- **CI/CD**: No releases with lint errors

---

## [1.0.16] - 2025-10-10

### Features
- **DOCX Parser Enhancement**: Added third-level fallback parser for non-standard DOCX
  - Supports DOCX from ONLYOFFICE and other suites
  - Direct XML parsing from DOCX ZIP when standard parsers fail
  - Strategy: officeparser → mammoth → direct XML extraction
  - Extracts `<w:t>` text from `word/document.xml`

### Bug Fixes
- **ONLYOFFICE Compatibility**: Fixed "no extractable text" error for ONLYOFFICE-created DOCX files
  - Previously both officeparser and mammoth returned empty strings
  - Now successfully extracts text using direct ZIP/XML parsing
  - Maintains backward compatibility with standard Microsoft DOCX files

### Dependencies
- **Added**: `jszip@^3.10.1` - ZIP archive manipulation for DOCX parsing
- **Added**: `@types/jszip@^3.4.1` (dev) - TypeScript definitions

### Technical Details
- Enhanced DOCX strategy with recursive XML text extraction
- Parser tries methods sequentially, returns first successful result
- Only throws error if all three methods fail
- Improved error message for truly corrupted/encrypted files

### Files Changed
- `src/FileToJsonNode.node.ts`: Enhanced DOCX processing with JSZip fallback
- `package.json`: Added jszip dependency

### Impact
- **Users**: ONLYOFFICE and other alternative office suite files now work correctly
- **Developers**: More robust DOCX handling with graceful fallbacks
- **Performance**: No impact - fallback only used when standard parsers fail

---

## [1.0.15] - 2025-10-10

### Bug Fixes
- **Error Messages**: Fixed hardcoded file size limit in error message
  - `FileTooLargeError` now displays actual configured limit instead of always showing "50 MB"
  - Users can set custom limits up to 100 MB in node settings
  - Error message now dynamically shows: `"File is too large (maximum XX MB)"` where XX is the configured value
  - Example: If limit set to 80 MB, error will show "maximum 80 MB" instead of "maximum 50 MB"

### Technical Details
- Modified error throw statement in line 735 to use dynamic `maxFileSize` parameter
- No functional changes to size validation logic - it already worked correctly
- Purely cosmetic fix to improve user experience and clarity

### Files Changed
- `src/FileToJsonNode.node.ts`: Updated FileTooLargeError message to be dynamic

---

## [1.0.14] - 2025-10-10

### Critical Bug Fixes
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

### Security
- **Dependencies**: Fixed critical vulnerability in `form-data`
  - Added `overrides` section to force `form-data@>=4.0.4` 
  - Resolves GHSA-fjxv-7rqg-78g4 (unsafe random boundary generation)
  - Zero breaking changes - uses npm overrides feature

### Documentation
- **Error Handling Analysis**: Added comprehensive documentation
  - Created `docs/error-handling-issues.md` with detailed problem analysis
  - Documented all 5 identified issues with before/after code examples
  - Included testing results and impact assessment

### Testing & Quality
- All 60 tests passing
- ESLint clean (0 errors, 1 pre-existing warning)
- TypeScript compilation successful
- Zero security vulnerabilities after fixes

### Impact
- **Users**: Clear, non-duplicated error messages with proper error types
- **Developers**: Cleaner codebase, better error handling patterns, improved type safety
- **Performance**: Eliminated unnecessary try-catch overhead in Excel processing

### Technical Details
- Modified error catching logic in main execute method (lines 772-783)
- Refactored XLSX strategy to remove control-flow exceptions (lines 478-499)
- Enhanced PDF fallback to capture both error contexts (lines 508-524)
- Added error type preservation in ODT/ODP/ODS handlers (lines 444-476)
- Fixed n8n-workflow import to use value-level exports

---

## [1.0.12] - 2025-10-09

### Bug Fixes & Improvements
- **Error Diagnostics**: Dramatically improved error message for EmptyFileError
  - Now shows file name, format, and size in error message
  - Lists 4 possible reasons why file might appear empty
  - Provides actionable recommendations for fixing the issue
  - Example: `File "doc.docx" (DOCX, 916.02 KB) contains no extractable text. Possible reasons: (1) File contains only images...`
  
- **DOCX Parser**: Enhanced error reporting for DOCX processing
  - Now reports failures from both primary (officeparser) and fallback (mammoth) parsers
  - Explicit handling of empty text results from parsers
  - Better debugging information for troubleshooting

### Documentation
- **TROUBLESHOOTING_EMPTY_FILE.md**: Complete guide for diagnosing empty file errors
  - 5 common reasons for empty file errors with solutions
  - Step-by-step diagnostic procedures
  - Alternative tools and manual extraction methods
  - Quick fix recipes for most common cases
  
- **FIX_EMPTY_FILE_ERROR.md**: Update instructions and changelog details
  - Multiple installation/update methods documented
  - Testing procedures for verification
  - Known issues vs actual bugs clarification

### Impact
- **User Experience**: Users now understand why processing failed and how to fix it
- **Developer Experience**: Easier to diagnose parser issues with detailed error messages
- **Support Reduction**: Self-service troubleshooting reduces support requests

### Technical Details
- Modified `strategies.docx` to explicitly handle empty strings
- Enhanced `EmptyFileError` throw location with contextual information
- No breaking changes - purely diagnostic improvements

---

## [1.0.11.1] - 2025-01-27

### Bug Fixes
- **GitHub Actions**: Fixed permissions error in release workflow
  - Added `checks: write` permission to release.yml
  - Resolves workflow error when calling ci.yml from release.yml
- **Code Quality**: Fixed all TypeScript linter errors (18 issues)
  - Replaced `any` types with proper interfaces for YML processing
  - Added type-safe interfaces: YmlCurrency, YmlCategory, YmlOffer, YmlShop, YmlCatalog
  - Fixed `require()` import in integration tests
  - Added eslint-disable comments for test files where needed
- **Build**: All tests passing (60/60) and linter clean

### Technical Details
- Enhanced type safety for YML processing functions
- Improved code maintainability and IDE support
- No functional changes - purely technical improvements

---

## [1.0.11] - 2025-01-27

### New Features
- **YML Support**: Added comprehensive support for YML file format
  - Specialized processing for Yandex Market catalog files (yml_catalog format)
  - Structured JSON output with sections: shop_info, currencies, categories, offers, statistics
  - Automatic detection of Yandex Market YML structure
  - Fallback to standard XML processing for regular YML files
  - Support for product parameters, images, delivery options
  - Performance optimized for typical catalog sizes with warnings for large datasets

### Technical Implementation
- Added `processYandexMarketYml` function for specialized YML processing
- Enhanced file type detection and processing strategies
- Comprehensive test coverage with integration and unit tests
- Updated documentation with YML examples and usage guidelines

### Files Added/Modified
- `src/FileToJsonNode.node.ts`: Added YML processing strategy
- `test/samples/sample_yandex_market.yml`: Sample YML test file
- `test/integration/yml-integration.test.ts`: Integration tests
- `test/unit/yml-processor.test.ts`: Unit tests
- `docs/yml_support.md`: Comprehensive YML documentation
- `README.md`: Updated with YML support information

### Impact
- Users can now process Yandex Market catalog files with structured output
- Enhanced data extraction capabilities for e-commerce integrations
- Backward compatible - no breaking changes

---

## [1.0.10] - 2025-06-20

### Bug Fixes
- **Critical**: Fixed support for ODT, ODP, ODS, and JSON file formats
  - Added missing format extensions to supported formats list
  - Resolves "Unsupported file type" error for these formats
  - Format processing strategies were already implemented but not accessible

### Technical Details
- Added `odt`, `odp`, `ods`, `json` to the `supported` array in FileToJsonNode
- All format handlers were previously implemented in the `strategies` object
- This was a configuration oversight that prevented format recognition

### Files Changed
- `src/FileToJsonNode.node.ts`: Updated supported formats array

### Impact
- Users can now successfully process OpenDocument formats (ODT, ODP, ODS)
- JSON files are now properly recognized and processed
- No breaking changes - purely additive fix

---

## [1.0.9] - 2025-06-20

### Bug Fixes
- **CI/CD**: Fixed Jest parameter compatibility issues
  - Updated `--testPathPattern` to `--testPathPatterns` in all CI commands
  - Resolves Jest 30+ compatibility problems
  - All CI tests now pass successfully

### Files Changed
- `.github/workflows/ci.yml`: Updated Jest command parameters

---

## Previous Versions

For changes in versions 1.0.8 and earlier, please see the [GitHub releases page](https://github.com/mazixs/n8n-node-converter-documents/releases).
