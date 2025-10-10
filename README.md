# 📄 n8n Document Converter Node

[![npm version](https://img.shields.io/npm/v/@mazix/n8n-nodes-converter-documents.svg)](https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-80%20passing-brightgreen.svg)](https://github.com/mazixs/n8n-node-converter-documents)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

> 🚀 **n8n community node** for converting various document formats to JSON/text with AI-friendly output

---

## 📑 Table of Contents

- [Features](#-features)
- [Supported Formats](#-supported-formats)
- [DOCX to HTML Conversion](#-docx-to-html-conversion-v1021)
- [XLSX Multi-Sheet Processing](#-xlsx-multi-sheet-processing)
- [Installation](#-installation)
- [Usage Examples](#-usage-examples)
- [Architecture](#-architecture)
- [Development](#-development)
- [Latest Updates](#-latest-updates)
- [Documentation](#-documentation)

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 Core Features
- ✅ **12+ file formats** supported
- ✅ Automatic file type detection
- ✅ Hybrid processing (primary + fallback)
- ✅ Stream processing for large files
- ✅ Promise pooling for concurrency control
- ✅ Comprehensive error handling

</td>
<td width="50%">

### 🔒 Security & Performance
- ✅ Input validation & sanitization
- ✅ XSS protection (sanitize-html)
- ✅ Path traversal protection
- ✅ Memory-efficient streaming
- ✅ Configurable file size limits (up to 100MB)
- ✅ JSON structure normalization

</td>
</tr>
</table>

---

## 📚 Supported Formats

| Category | Formats | Status |
|----------|---------|--------|
| **Text Documents** | DOCX, ODT, TXT, PDF | ✅ Full Support |
| **Spreadsheets** | XLSX, ODS, CSV | ✅ Multi-sheet support |
| **Presentations** | PPTX, ODP | ✅ Full Support |
| **Web & Data** | HTML, HTM, XML, JSON | ✅ Full Support |
| **E-commerce** | YML (Yandex Market) | ✅ Specialized parsing |
| **Legacy** | DOC, PPT, XLS | ❌ Not supported* |

> *Legacy formats require conversion to modern formats (DOCX, PPTX, XLSX)

---

## 📊 DOCX to HTML Conversion (v1.0.21+)

> **Latest:** Node renamed to "Document Converter" in v1.0.22

### 🎨 Choose Your Output Format

<table>
<tr>
<th width="50%">📝 Plain Text (Default)</th>
<th width="50%">🌐 HTML Format</th>
</tr>
<tr>
<td>

**Best for:**
- Simple text extraction
- Minimal output size
- Maximum speed
- Backward compatibility

**Output size:** ~3,600 chars

</td>
<td>

**Best for:**
- Documents with **tables**
- AI/LLM processing
- Preserving formatting
- Structured content

**Output size:** ~58,000 chars (+1,591%)

</td>
</tr>
</table>

### 📋 Usage in n8n

```
1. Add "Document Converter" node
2. Select "Output Format (DOCX)" parameter:
   • Plain Text → Simple extraction
   • HTML → Tables + formatting preserved
```

### 💡 Example Output

<details>
<summary><b>Plain Text Output</b></summary>

```json
{
  "text": "Situation: Often search by one field\nAction: Create index on that field"
}
```
</details>

<details>
<summary><b>HTML Output (with tables)</b></summary>

```json
{
  "text": "<table><tr><td><strong>Situation</strong></td><td><strong>Action</strong></td></tr><tr><td>Often search by one field</td><td>Create index on that field</td></tr></table>"
}
```
</details>

### 🎯 HTML Format Features

| Feature | Description |
|---------|-------------|
| **Tables** | `<table>`, `<tr>`, `<td>` - full structure preserved |
| **Formatting** | `<strong>`, `<em>`, `<h1>`-`<h6>` |
| **Lists** | `<ul>`, `<ol>`, `<li>` |
| **Paragraphs** | `<p>` tags for structure |
| **AI-Friendly** | ✅ Understood by ChatGPT, Claude, Gemini |

---

## 📊 XLSX Multi-Sheet Processing

### 🗂️ How It Works

```json
{
  "sheets": {
    "Products": [
      { "A": "ID", "B": "Name", "C": "Price" },
      { "A": 1, "B": "Apple", "C": 100 },
      { "A": 2, "B": "Banana", "C": 50 }
    ],
    "Orders": [
      { "A": "Order", "B": "Quantity" },
      { "A": 101, "B": 5 }
    ]
  }
}
```

### 📌 Key Features

| Feature | Details |
|---------|---------|
| **Multiple Sheets** | Each sheet = separate array in `sheets` object |
| **Column Names** | A, B, C... Z (Excel-style) |
| **Row Format** | Array of objects (rows) |
| **Empty Cells** | Skipped (only filled cells included) |
| **Size Limit** | 10,000 rows per sheet (configurable) |
| **Memory Safe** | Large files auto-limited to prevent OOM |

---

## 🚀 Installation

### Option 1: npm Package (Recommended)

Via **n8n web interface**:
```
Settings → Community nodes → Install
Package name: @mazix/n8n-nodes-converter-documents
```

Or via **command line**:
```bash
npm install @mazix/n8n-nodes-converter-documents
```

### Option 2: Standalone Version

```bash
# 1. Clone and build
git clone https://github.com/mazixs/n8n-node-converter-documents.git
cd n8n-node-converter-documents
npm install
npm run standalone

# 2. Copy to n8n
cp -r ./standalone ~/.n8n/custom-nodes/n8n-node-converter-documents
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
npm install

# 3. Restart n8n
```

### Option 3: Manual Installation

```bash
mkdir -p ~/.n8n/custom-nodes/n8n-node-converter-documents
cp dist/*.js dist/*.svg ~/.n8n/custom-nodes/n8n-node-converter-documents/
cp package.json ~/.n8n/custom-nodes/n8n-node-converter-documents/
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
npm install --production
```

---

## 📖 Usage Examples

### Text Document Output

```json
{
  "text": "Extracted text content...",
  "metadata": {
    "fileName": "document.docx",
    "fileSize": 12345,
    "fileType": "docx",
    "processedAt": "2024-06-01T12:00:00.000Z"
  }
}
```

### Excel Spreadsheet Output

```json
{
  "sheets": {
    "Sheet1": [
      { "A": "Name", "B": "Age", "C": "City" },
      { "A": "Alice", "B": 30, "C": "Moscow" },
      { "A": "Bob", "B": 25, "C": "SPB" }
    ]
  },
  "metadata": {
    "fileName": "data.xlsx",
    "fileSize": 23456,
    "fileType": "xlsx"
  }
}
```

### JSON Normalization

**Input:**
```json
{
  "user": {
    "name": "John",
    "address": { "city": "Moscow" }
  }
}
```

**Output (flattened):**
```json
{
  "text": "{\n  \"user.name\": \"John\",\n  \"user.address.city\": \"Moscow\"\n}",
  "warning": "Multi-level JSON structure was converted to flat object"
}
```

---

## 🏗️ Architecture

### Strategy Pattern Implementation

```typescript
DOCX Processing Flow:
┌─────────────────────────────────────┐
│ 1. If outputFormat === 'html':     │
│    → mammoth.convertToHtml()       │
│    → [Success] Return HTML          │
│    → [Fail] Fallback to text       │
│                                     │
│ 2. Text mode (default):            │
│    → officeparser (primary)        │
│    → mammoth.extractRawText (fb)   │
│    → XML direct parsing (last)     │
└─────────────────────────────────────┘
```

### Technology Stack

<table>
<tr>
<td width="50%">

**Core Libraries**
- `officeparser` (v5.1.1) - Primary parser
- `mammoth` (v1.9.1) - DOCX processor
- `exceljs` (v4.4.0) - Excel handler
- `pdf-parse` (v1.1.1) - PDF fallback
- `papaparse` (v5.5.3) - CSV parser

</td>
<td width="50%">

**Build & Quality**
- TypeScript 5.8 (strict mode)
- Jest (80 tests passing)
- ESLint (TypeScript rules)
- Webpack bundling
- CommonJS modules

</td>
</tr>
</table>

### Security Features

| Feature | Implementation |
|---------|----------------|
| **Input Validation** | Strict type & structure checks |
| **XSS Protection** | `sanitize-html` library |
| **Path Traversal** | File name sanitization |
| **Memory Limits** | 10K rows/sheet, 50MB default |
| **Dependency Audit** | Regular `npm audit` checks |

---

## 💻 Development

### Quick Start

```bash
npm install        # Install dependencies
npm run dev        # Watch mode
npm run build      # Compile
npm test           # Run 80 tests
npm run lint       # Check code quality
```

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | TypeScript → JavaScript |
| `npm run bundle` | Webpack bundling |
| `npm run standalone` | Standalone with deps |
| `npm run test:coverage` | Coverage report |
| `npm run lint:fix` | Auto-fix issues |

### Project Structure

```
├── src/
│   ├── FileToJsonNode.node.ts  # Main node (Strategy Pattern)
│   ├── helpers.ts               # Utilities
│   └── errors.ts                # Custom errors
├── test/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── samples/                 # Test files
├── docs/                        # Documentation
│   ├── SOLUTION.md
│   ├── HTML_CONVERSION_PLAN.md
│   └── MAMMOTH_ANALYSIS.md
└── dist/                        # Compiled output
```

---

## 📈 Latest Updates

### 🎉 v1.0.22 (Current - 2025-10-10)

<table>
<tr>
<td width="50%">

**🎨 UI & Quality**
- ✅ **Node renamed**: "Document Converter"
- ✅ **Icon fixed**: 60×60 (proper size)
- ✅ **Code refactored**: -78 lines
- ✅ **Zero duplication**: 100% eliminated
- ✅ **Full error handling**: PPTX fixed

</td>
<td width="50%">

**📚 Docs & Tests**
- ✅ **README redesign**: Badges, TOC, tables
- ✅ **80 tests passing** (+7 XLSX)
- ✅ **Full JSDoc**: All functions documented
- ✅ **Better IntelliSense**: IDE support improved
- ✅ **Professional look**: Visual tables & icons

</td>
</tr>
</table>

**What's New:**
```diff
+ Node renamed to "Document Converter" (better UX)
+ Icon size fixed: 2048×1853 → 60×60
+ Code quality: eliminated all duplication
+ BaseConverterError class (DRY principle)
+ checkCFBFormat() helper (unified CFB check)
+ processViaOfficeParser() helper (unified error handling)
+ Full JSDoc documentation added
+ README complete visual redesign
+ 7 new XLSX multi-sheet tests
```

### Previous Versions

<details>
<summary><b>v1.0.21</b> - DOCX to HTML Conversion</summary>

- DOCX to HTML conversion with table support
- outputFormat parameter (text | html)
- Table preservation in HTML
- AI/LLM friendly output
- 73 tests passing
</details>

<details>
<summary><b>v1.0.20</b> - TextBox & Shapes Support</summary>

- Extract text from TextBoxes and shapes
- ONLYOFFICE document fix
- 62 tests passing
</details>

<details>
<summary><b>v1.0.19</b> - ONLYOFFICE Parser Fix</summary>

- Fixed XML namespace extraction
- No more schema URLs in output
- 61 tests passing
</details>

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Complete version history |
| [SOLUTION.md](docs/SOLUTION.md) | Architecture overview |
| [HTML_CONVERSION_PLAN.md](docs/HTML_CONVERSION_PLAN.md) | DOCX to HTML implementation |
| [MAMMOTH_ANALYSIS.md](docs/MAMMOTH_ANALYSIS.md) | Library research findings |
| [optimization_plan.md](docs/optimization_plan.md) | Performance strategies |
| [security.md](docs/security.md) | Security features |

---

## 🔧 Troubleshooting

### Common Issues

**Error: `Cannot find module 'exceljs'`**
```bash
# Solution 1: Use standalone version (recommended)
npm run standalone

# Solution 2: Check dependencies
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
npm list
npm install
```

**Large files causing OOM**
- Split files into smaller parts
- Reduce `maxFileSize` parameter
- Use streaming for CSV/TXT formats

---

## ⚠️ Limitations

| Limitation | Details | Workaround |
|------------|---------|------------|
| **Legacy formats** | DOC, PPT, XLS not supported | Convert to DOCX, PPTX, XLSX |
| **Memory** | Large PDF/XLSX load into RAM | Split files or increase memory |
| **File size** | Default 50MB limit | Configurable up to 100MB |

---

## 📊 Statistics

- **12+** file formats supported
- **80** tests passing
- **5** specialized parsers
- **10K** rows per sheet limit
- **100MB** max file size
- **0** critical vulnerabilities

---

## 🤝 Contributing

Issues and pull requests are welcome!

---

## 📝 License

MIT © mazix

---

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents)
- [GitHub Repository](https://github.com/mazixs/n8n-node-converter-documents)
- [n8n Community](https://community.n8n.io/)

---

<div align="center">

**Made with ❤️ for the n8n community**

If you find this helpful, please ⭐ star the repository!

</div>
