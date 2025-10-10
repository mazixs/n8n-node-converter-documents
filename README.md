# n8n-nodes-converter-documents

## 📄 Product Overview

This is an n8n community node package that converts various document formats to JSON or text format. The node supports a wide range of file types including:

- **Office Documents**: DOCX, PPTX, XLSX (modern formats only)
- **OpenDocument**: ODT, ODP, ODS (LibreOffice/OpenOffice)
- **Data Formats**: XML, YML, CSV, JSON, PDF, TXT, HTML/HTM
- **Special Support**: Yandex Market YML catalogs with structured parsing

## Key Features

- Automatic file type detection by extension or content analysis
- Hybrid processing approach with primary and fallback parsers
- Security-focused with input validation and XSS protection
- Memory-efficient streaming for large files
- JSON structure normalization (flattens nested objects)
- Comprehensive error handling with custom error types
- Performance optimizations with concurrent processing limits
- **NEW**: DOCX to HTML conversion with table preservation

## 📊 DOCX Output Formats (v1.0.21+)

Choose between two output formats for DOCX files:

### Plain Text (Default)
- Fast extraction, minimal output size
- ~3,600 characters for typical documents
- Best for simple text extraction
- Backward compatible with all existing workflows

### HTML Format
- Preserves document structure and formatting
- **Tables** converted to `<table>`, `<tr>`, `<td>` (perfect for AI/LLM processing)
- **Formatting**: `<strong>`, `<em>`, `<h1>-<h6>`, `<ul>`, `<ol>`, `<p>`
- ~58,000 characters (+1,591% vs plain text)
- AI-friendly: understood by ChatGPT, Claude, and other models

### Usage in n8n

1. Add "Convert File to JSON" node
2. Select parameter **"Output Format (DOCX)"**:
   - **Plain Text** - for simple text extraction
   - **HTML** - for tables and formatted content

### Example Output

**Plain Text:**
```json
{
  "text": "Situation: Often search by one field\nAction: Create index on that field"
}
```

**HTML:**
```json
{
  "text": "<table><tr><td><strong>Situation</strong></td><td><strong>Action</strong></td></tr><tr><td>Often search by one field</td><td>Create index on that field</td></tr></table>"
}
```

### When to Use HTML

- ✅ Document contains tables
- ✅ Processing with AI/LLM (ChatGPT, Claude, etc.)
- ✅ Need to preserve formatting (bold, italic, headings)
- ✅ Lists and document structure are important

## Architecture Philosophy

The node uses a strategy pattern with format-specific processors and intelligent fallbacks. Primary library is `officeparser` with specialized fallbacks like `mammoth` for DOCX and `pdf-parse` for PDFs. This provides better compatibility and error resilience.

## Limitations

- Legacy Microsoft Office files (DOC, PPT, XLS) are not supported due to CFB format complexity
- Large files (tens of MB, hundreds of thousands of rows) may cause memory issues
- Maximum file size limit of 50MB (configurable)

### ⚠️ Important Note about Legacy Microsoft Office Files

- **DOCX** (Word 2007+) - ✅ Fully supported
- **DOC** (Word 97-2003) - ❌ Not supported due to legacy CFB format limitations
- **PPTX** (PowerPoint 2007+) - ✅ Fully supported
- **PPT** (PowerPoint 97-2003) - ❌ Not supported due to legacy CFB format limitations
- **XLSX** (Excel 2007+) - ✅ Fully supported

### ✨ OpenDocument Format Support

- **ODT** (OpenDocument Text) - ✅ LibreOffice Writer documents
- **ODP** (OpenDocument Presentation) - ✅ LibreOffice Impress presentations
- **ODS** (OpenDocument Spreadsheet) - ✅ LibreOffice Calc spreadsheets

### 🛒 Yandex Market YML Support

- **YML** (Yandex Market Catalog) - ✅ Specialized parsing for Yandex Market product feeds
  - Automatic detection of YML catalog structure (`yml_catalog` root element)
  - Structured extraction of shop information, categories, and product offers
  - Statistical analysis (total products, available/unavailable items)
  - Parameter and attribute processing
  - Fallback to regular XML parsing for non-Yandex YML files

### 🔄 JSON Processing

- **JSON** files with automatic structure normalization - complex nested objects are flattened for easier processing

> **Note**: If you have old DOC/PPT files, please save them as DOCX/PPTX in Microsoft Office and try again.

## 🏗️ Technology Stack & Architecture

### Core Technologies

- **Runtime**: Node.js with TypeScript (ES2020 target)
- **Module System**: CommonJS
- **Package Manager**: npm with package-lock.json
- **Build System**: TypeScript compiler + Webpack bundling

### Architecture & Performance Optimizations

The node uses a hybrid approach with **officeparser** as the primary library for most document formats, with intelligent fallbacks:

- **Primary**: `officeparser` (supports DOCX, PPTX, XLSX, PDF, ODT, ODP, ODS)
- **Fallback for DOCX**: `mammoth` (if officeparser fails)  
- **Fallback for PDF**: `pdf-parse` (if officeparser fails)
- **Excel structure**: `ExcelJS` (for structured data extraction)
- **HTML/XML**: `cheerio` + `xml2js`
- **CSV**: `papaparse`
- **JSON**: Built-in normalization with structure flattening

This approach provides:
- ✅ Better format compatibility
- ✅ Improved error handling
- ✅ Performance optimization
- ✅ Reduced dependency complexity

### Development Patterns

- Strategy pattern for file format processors
- Custom error classes for different failure modes
- Promise pooling for concurrent processing limits
- Stream processing for large files
- Comprehensive input validation and sanitization

## ⚠️ Important: Large File Limitations

- **PDF, XLSX:** The libraries used load the entire file into memory. When processing very large files (tens of megabytes, hundreds of thousands of rows), crashes, freezes, and memory limit exceeded errors are possible. For such cases, it's recommended to split files into smaller parts.

## 🔒 Security and Validation

- Input data undergoes strict validation (type, structure, size, presence of binary data)
- Path traversal protection for file names
- XSS protection using sanitize-html for HTML content
- File size limits and memory management
- **Security updates:** Replaced vulnerable libraries with secure alternatives (textract → officeparser)
- Regular dependency checks using npm audit and audit-ci
- See [Security Documentation](docs/security.md) for detailed security considerations

## 🚀 Output Data Structure

- **Text formats**: `{ text: "..." }` + metadata (name, size, file type, processing time)
- **Tabular formats**: `{ sheets: {...} }` + metadata for structured data
- **Metadata**: Includes file name, size, type, and processing timestamp
- **Error handling**: Clear error messages for unsupported formats (e.g., old PPT files)
- **Warnings**: Informative messages for large files or processing limitations

## 📚 Key Dependencies

### Document Processing Libraries
- `officeparser` (v5.1.1) - Primary document parser with PDF.js support
- `mammoth` (v1.9.1) - DOCX fallback processor
- `exceljs` (v4.4.0) - Excel file processing with full feature support
- `pdf-parse` (v1.1.1) - PDF fallback processor
- `cheerio` (v1.1.0) - HTML/XML processing
- `papaparse` (v5.5.3) - CSV processing
- `xml2js` (v0.6.2) - XML parsing

### Utility Libraries
- `chardet` (v2.1.0) - Character encoding detection
- `iconv-lite` (v0.6.3) - Character encoding conversion
- `file-type` (v21.0.0) - File type detection
- `sanitize-html` (v2.17.0) - XSS protection

### n8n Integration
- `n8n-workflow` - Peer dependency for n8n node development

## 🔧 Build Commands

### Development
```bash
npm run dev          # TypeScript watch mode
npm run build        # Compile TypeScript to dist/
npm run lint         # ESLint with TypeScript support
npm run lint:fix     # Auto-fix linting issues
```

### Testing
```bash
npm test             # Run Jest test suite
npm run test:watch   # Jest in watch mode
npm run test:coverage # Generate coverage reports
```

### Distribution
```bash
npm run bundle       # Create webpack bundle for distribution
npm run standalone   # Generate standalone version with dependencies
npm run clean        # Remove dist/, coverage/, bundle/ directories
```

### Release Management
```bash
npm run version:patch   # Bump patch version
npm run version:minor   # Bump minor version
npm run version:major   # Bump major version
npm run release:patch   # Version bump + git push + tags
```

## 🔧 Build Configuration

- **TypeScript**: Strict mode enabled, ES2020 target, CommonJS modules
- **Webpack**: Production bundle with externals for n8n modules
- **ESLint**: Modern flat config with TypeScript rules
- **Jest**: ts-jest preset with 30s timeout for file processing tests

## 📊 Input and Output Data Examples

**Input:**
- Binary file (e.g., DOCX, PDF, XLSX, etc.) in the `data` field

**Output:**

### For text formats:
```json
{
  "text": "Extracted text...",
  "metadata": {
    "fileName": "example.docx",
    "fileSize": 12345,
    "fileType": "docx",
    "processedAt": "2024-06-01T12:00:00.000Z"
  }
}
```

### For tabular formats:
```json
{
  "sheets": {
    "Sheet1": [ { "A": "Value1", "B": "Value2" }, ... ]
  },
  "metadata": {
    "fileName": "example.xlsx",
    "fileSize": 23456,
    "fileType": "xlsx",
    "processedAt": "2024-06-01T12:00:00.000Z"
  }
}
```

### For JSON normalization:

**Input JSON:**
```json
{
  "user": {
    "name": "John",
    "address": {
      "city": "Moscow",
      "country": "Russia"
    }
  }
}
```

**Output:**
```json
{
  "text": "{\n  \"user.name\": \"John\",\n  \"user.address.city\": \"Moscow\",\n  \"user.address.country\": \"Russia\"\n}",
  "warning": "Multi-level JSON structure was converted to flat object",
  "metadata": {
    "fileName": "data.json",
    "fileSize": 156,
    "fileType": "json",
    "processedAt": "2024-06-01T12:00:00.000Z"
  }
}
```

### For Yandex Market YML files:

**Input YML:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2024-01-15 12:00">
  <shop>
    <name>Test Shop</name>
    <categories>
      <category id="1">Electronics</category>
    </categories>
    <offers>
      <offer id="12345" available="true">
        <name>Smartphone</name>
        <price>50000</price>
        <vendor>Apple</vendor>
      </offer>
    </offers>
  </shop>
</yml_catalog>
```

**Output:**
```json
{
  "text": "{\n  \"yandex_market_catalog\": {\n    \"shop_info\": {\n      \"name\": \"Test Shop\",\n      \"date\": \"2024-01-15 12:00\"\n    },\n    \"categories\": [\n      {\"id\": \"1\", \"name\": \"Electronics\"}\n    ],\n    \"offers\": [\n      {\n        \"id\": \"12345\",\n        \"name\": \"Smartphone\",\n        \"price\": \"50000\",\n        \"vendor\": \"Apple\",\n        \"available\": \"true\"\n      }\n    ],\n    \"statistics\": {\n      \"total_categories\": 1,\n      \"total_offers\": 1,\n      \"available_offers\": 1,\n      \"unavailable_offers\": 0\n    }\n  }\n}",
  "metadata": {
    "fileName": "catalog.yml",
    "fileSize": 512,
    "fileType": "yml",
    "processedAt": "2024-06-01T12:00:00.000Z"
  }
}
```

## 📁 Project Structure

```
├── src/                    # Source code (TypeScript)
├── dist/                   # Compiled JavaScript output
├── test/                   # Test files and fixtures
├── docs/                   # Documentation and guides
├── bundle/                 # Webpack bundled output
├── standalone/             # Standalone distribution
├── .github/                # GitHub Actions CI/CD
└── .kiro/                  # Kiro IDE configuration
```

### Source Code Organization (`src/`)

- `FileToJsonNode.node.ts` - Main n8n node implementation with strategy pattern
- `helpers.ts` - Utility functions for document processing
- `errors.ts` - Custom error classes for different failure modes
- `icon.svg` - Node icon for n8n interface

### Test Structure (`test/`)

- `unit/` - Unit tests for individual components
- `integration/` - Integration tests with real files
- `samples/` - Test files for various formats
- `fixtures/` - Test data and expected outputs
- `setup.ts` - Jest test environment setup

### Documentation (`docs/`)

- `SOLUTION.md` - Technical solution overview
- `optimization_plan.md` - Performance optimization strategies
- `yml_support.md` - Yandex Market YML implementation details
- `testing_strategy.md` - Test structure and coverage information
- `security.md` - Security features and best practices

### Distribution Outputs

- `dist/` - TypeScript compilation output (main distribution)
- `bundle/` - Webpack bundled single file for n8n
- `standalone/` - Self-contained version with all dependencies

### Configuration Files

- `package.json` - Dependencies, scripts, n8n node registration
- `tsconfig.json` - TypeScript compiler configuration
- `webpack.config.js` - Bundle configuration for n8n distribution
- `jest.config.js` - Test runner configuration
- `eslint.config.mjs` - Modern ESLint flat configuration

## Naming Conventions

- **Files**: kebab-case for config files, PascalCase for main classes
- **Classes**: PascalCase (e.g., `FileToJsonNode`)
- **Functions**: camelCase (e.g., `extractViaOfficeParser`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `CSV_STREAM_ROW_LIMIT`)
- **Interfaces**: PascalCase with descriptive names (e.g., `JsonTextResult`)

## Code Organization Patterns

- **Strategy Pattern**: Format-specific processors in `strategies` object
- **Error Hierarchy**: Custom error classes extending base `Error`
- **Async/Await**: Consistent promise handling throughout
- **Type Safety**: Strict TypeScript with comprehensive interfaces
- **Validation**: Input sanitization and type checking at boundaries

## 📦 Installing Dependencies

All necessary dependencies are installed via npm:

```bash
npm install
```

## 💻 Development

```bash
# Install dependencies
npm install

# Development with automatic rebuild
npm run dev

# Build project
npm run build

# Run tests
npm test

# Tests with coverage
npm run test:coverage

# Linting
npm run lint

# Fix linting
npm run lint:fix
```

## 💡 Recommendations

- To add new formats, you'll need to add the corresponding library and handler to the main file
- For n8n integration, make sure the node is correctly connected to your system
- For working with very large PDF, XLSX files, use preprocessing or third-party tools
- For security, always update dependencies and keep sanitize-html up to date
- Regularly check for vulnerabilities using `npm audit`

## 🔨 Build and Use with TypeScript

1. To build the project, run:
   ```bash
   npm run build
   ```
   The resulting files will appear in the `dist/` folder.

2. To use the custom node in n8n, specify the path to `dist/FileToJsonNode.node.js`.

3. Main file for n8n: `dist/FileToJsonNode.node.js` (see `main` field in package.json).

## 🚀 Usage in n8n

**Update v1.0.10**: Fixed support for ODT, ODP, ODS, JSON formats + improved architecture ✅

### Option 1: Install as npm package (recommended)

Or via n8n web interface:
1. Open Settings → Community nodes
2. Enter: `@mazix/n8n-nodes-converter-documents`
3. Click Install

### Option 2: Standalone version (easiest way)

1. **Create standalone version:**
   ```bash
   git clone https://github.com/mazixs/n8n-node-converter-documents.git
   cd n8n-node-converter-documents
   npm install
   npm run standalone
   ```

2. **Copy to n8n:**
   ```bash
   cp -r ./standalone ~/.n8n/custom-nodes/n8n-node-converter-documents
   cd ~/.n8n/custom-nodes/n8n-node-converter-documents
   npm install
   ```

3. **Restart n8n**

### Option 3: Manual installation

1. **Copy files to custom nodes folder:**
   ```bash
   mkdir -p ~/.n8n/custom-nodes/n8n-node-converter-documents
   cp dist/*.js dist/*.svg ~/.n8n/custom-nodes/n8n-node-converter-documents/
   cp package.json ~/.n8n/custom-nodes/n8n-node-converter-documents/
   ```

2. **Install dependencies in custom node folder:**
   ```bash
   cd ~/.n8n/custom-nodes/n8n-node-converter-documents
   npm install --production
   ```

3. **Restart n8n**

### ⚠️ Note: TypeScript Types and Source Maps

The `dist/` folder contains additional files:
- `*.d.ts` — TypeScript type definitions (optional for runtime)
- `*.js.map` — Source maps for debugging (optional for production)

These files are automatically included when installing via npm but can be omitted for manual installation to save space.

## 🔧 Troubleshooting

If you see an error `Cannot find module 'exceljs'` (or other modules):

1. **Use standalone version** - this is the most reliable method
2. Make sure dependencies are installed in the correct folder
3. Check access permissions to `~/.n8n/custom-nodes/` folder
4. Use npm package option instead of custom nodes

### Installation Check

After installation, you can verify the node is working:
```bash
# Check that files are copied
ls -la ~/.n8n/custom-nodes/n8n-node-converter-documents/

# Check that dependencies are installed
cd ~/.n8n/custom-nodes/n8n-node-converter-documents/
npm list
```

## 📋 Supported File Formats

- **Text formats:** DOCX, ODT, TXT, PDF
- **Spreadsheet formats:** XLSX, ODS, CSV *(XLS is not supported - please convert to XLSX)*
- **Presentation formats:** PPTX, ODP *(PPT is not supported - please convert to PPTX)*
- **Web formats:** HTML, HTM
- **Data formats:** XML, JSON (with structure normalization)

## 📈 Latest Updates

### v1.0.21 (Current - 2025-10-10)
- **🚀 Major Feature**: DOCX to HTML conversion with table support
- **NEW Parameter**: `outputFormat` for DOCX files (text | html)
- **Tables**: Fully preserved in HTML format (`<table>`, `<tr>`, `<td>`)
- **AI-Friendly**: HTML understood by ChatGPT, Claude, and other LLMs
- **Formatting**: Bold, italic, headings, lists, paragraphs preserved
- **Zero Dependencies**: Uses existing mammoth library
- **73 tests passing** (+5 new tests)
- **Documentation**: Complete research and implementation guides

### v1.0.20 (2025-10-10)
- **🚀 TextBox & Shapes Support**: Extract text from TextBoxes and shapes
- **🐛 ONLYOFFICE Fix**: Fixed text extraction from complex documents
- **62 tests passing**

### v1.0.19 (2025-10-10)
- **🐛 Critical Fix**: ONLYOFFICE DOCX parser - no more XML namespaces in output
- **Enhanced extraction**: Targets only `<w:t>` tag content
- **61 tests passing**

For complete changelog see [CHANGELOG.md](CHANGELOG.md)
- All CI tests now pass successfully

## 📚 Additional Documentation

- [Technical Solution Overview](docs/SOLUTION.md) - Architecture and implementation details
- [Performance Optimization Strategies](docs/optimization_plan.md) - Dependency analysis and optimization plans
- [Yandex Market YML Implementation](docs/yml_support.md) - YML catalog processing details
- [Testing Strategy](docs/testing_strategy.md) - Test structure and coverage information
- [Security Considerations](docs/security.md) - Security features and best practices

---

If you need documentation for any module or help with integration — feel free to ask!
