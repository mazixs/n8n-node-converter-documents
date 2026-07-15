# n8n Document Converter Node

[![npm version](https://img.shields.io/npm/v/@mazix/n8n-nodes-converter-documents.svg)](https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-57%20passing-brightgreen.svg)](https://github.com/mazixs/n8n-node-converter-documents)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![n8n](https://img.shields.io/badge/n8n-2.7.0-orange.svg)](https://n8n.io/)

> **n8n community node** for converting documents to JSON/text. Supports 15+ formats with AI-friendly output.

---

## Table of Contents

- [Supported Formats](#supported-formats)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Output Examples](#output-examples)
- [Architecture](#architecture)
- [Development](#development)
- [License](#license)

---

## Supported Formats

| Category | Formats | Details |
|----------|---------|---------|
| **Documents** | DOCX, DOC, ODT, TXT, PDF | Text, HTML, or Markdown output for DOCX |
| **Spreadsheets** | XLSX, ODS, CSV | Multi-sheet parsing for XLSX/ODS and CSV |
| **Presentations** | PPTX, PPT, ODP | Text extraction |
| **Web & Data** | HTML, HTM, XML, JSON | Structure-aware parsing |
| **E-commerce** | YML (Yandex Market) | Specialized shop/offers/categories parsing |

---

## Features

**Core**
- Automatic file type detection via magic bytes
- Strategy pattern: each format has its own processing pipeline
- DOCX output: plain text (default), HTML, or **Markdown** (GFM tables, headings, bold/italic)
- DOCX → Markdown ideal for AI/LLM/RAG pipelines
- XLSX multi-sheet processing with Excel-style column names (A, B, C...)
- JSON flattening for nested structures
- YML (Yandex Market) specialized parser
- `usableAsTool: true` for n8n AI Agent integration

**Reliability**
- Concurrency control via promise pool (Set-based, no race conditions)
- Fallback chains: DOCX uses officeparser -> mammoth, DOC/PPT uses CFB signature check + officeparser
- File name sanitization (path traversal protection)
- Configurable file size limits (up to 100MB)
- Custom error classes with descriptive messages

---

## Installation

### Via n8n UI (recommended)

```
Settings -> Community nodes -> Install
Package name: @mazix/n8n-nodes-converter-documents
```

### Via CLI

```bash
cd ~/.n8n
npm install @mazix/n8n-nodes-converter-documents
# Restart n8n
```

### Manual

```bash
git clone https://github.com/mazixs/n8n-node-converter-documents.git
cd n8n-node-converter-documents
npm install
npm run build
# Copy dist/ and package.json to ~/.n8n/custom-nodes/n8n-node-converter-documents/
```

---

## Usage

1. Add **"Convert File to JSON"** node to your workflow
2. Connect a node that provides binary data (e.g., Read Binary File, HTTP Request)
3. Configure parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Binary Property** | `data` | Name of the binary property with the file |
| **Output Format (DOCX)** | `text` | `text`, `html`, or `markdown` (GFM with tables) |
| **Max File Size (MB)** | `50` | File size limit |
| **Max Concurrency** | `4` | Parallel file processing |

---

## Output Examples

### Text document (DOCX, PDF, TXT, etc.)

```json
{
  "text": "Extracted document content...",
  "metadata": {
    "fileName": "report.docx",
    "fileSize": 12345,
    "fileType": "docx",
    "processedAt": "2026-02-08T00:00:00.000Z"
  }
}
```

### DOCX with HTML output

```json
{
  "text": "<p>Introduction</p><table><tr><td>Name</td><td>Value</td></tr>...</table>",
  "metadata": { "fileName": "data.docx", "fileType": "docx" }
}
```

### DOCX with Markdown output

```json
{
  "text": "# Introduction\n\n| Name | Value |\n| --- | --- |\n| Item | 100 |\n\n**Bold text** and _italic_",
  "metadata": { "fileName": "data.docx", "fileType": "docx" }
}
```

### XLSX (multi-sheet)

```json
{
  "sheets": {
    "Products": [
      { "A": "ID", "B": "Name", "C": "Price" },
      { "A": 1, "B": "Apple", "C": 100 }
    ],
    "Orders": [
      { "A": "Order", "B": "Qty" },
      { "A": 101, "B": 5 }
    ]
  },
  "metadata": { "fileName": "data.xlsx", "fileType": "xlsx" }
}
```

### JSON (flattened)

```json
{
  "text": "{\n  \"user.name\": \"John\",\n  \"user.address.city\": \"London\"\n}",
  "warning": "Multi-level JSON structure was converted to flat object"
}
```

### YML (Yandex Market)

```json
{
  "text": "{ \"shop\": { \"name\": \"MyShop\" }, \"currencies\": [...], \"categories\": [...], \"offers\": [...] }"
}
```

---

## Architecture

### Project Structure

```
src/
├── FileToJsonNode.node.ts   # Node class (~220 lines)
├── types.ts                 # Interfaces (JsonResult, StrategyFn, YML types)
├── errors.ts                # Custom error classes
├── helpers.ts               # extractViaOfficeParser, limitExcelSheet
├── strategies/
│   └── index.ts             # All format strategies
├── processors/
│   └── yml.ts               # Yandex Market YML processor
└── utils/
    ├── sanitize.ts          # File name sanitization
    ├── promisePool.ts       # Concurrency control (Set-based)
    ├── columns.ts           # numberToColumn (1→A, 27→AA)
    ├── flatten.ts           # JSON flattening
    └── index.ts             # Barrel export
```

### Processing Flow

```
Input binary → detect file type (magic bytes) → select strategy → process → output JSON
                                                      │
                              ┌────────────────────────┼────────────────────┐
                              │                        │                    │
                         Text formats            Spreadsheets         Special
                     (DOCX, PDF, TXT,          (XLSX, CSV, ODS)    (XML, JSON,
                      PPTX, HTML, ODT,                               YML, HTML)
                      ODP, DOC, PPT)
```

### Technology Stack

| Component | Library | Version |
|-----------|---------|---------|
| DOCX/PDF/PPTX/OD* | officeparser | 6.1.1 |
| DOCX (HTML/MD) | mammoth | ^1.11.0 |
| HTML → Markdown | node-html-markdown | ^2.0.0 |
| XLSX | read-excel-file | ^6.0.3 |
| CSV | papaparse | ^5.5.3 |
| XML/YML | fast-xml-parser | 5.10.0 |
| HTML | node-html-parser | ^7.0.2 |
| Encoding | chardet | ^2.1.1 |
| File type | file-type | 22.0.1 |
| n8n SDK | n8n-workflow | ^2.7.0 |
| Runtime | Node.js | >=20.19 |
| Language | TypeScript | 5.8 (strict) |
| Tests | Jest | 30.x |

---

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run 77 tests (17 suites)
npm run lint         # ESLint check
npm run dev          # Watch mode
npm run test:coverage # Coverage report
```

### CI/CD

- **CI** (`ci.yml`): lint -> build -> test -> security audit on push/PR to main/develop
- **Auto Release** (`auto-release.yml`): creates GitHub Release + git tag on version bump in main
- **npm publish**: manual (`npm publish --access public`)

---

## Limitations

| Limitation | Details |
|------------|---------|
| **Legacy XLS** | Binary Excel not supported, convert to XLSX |
| **Node.js** | Version 20.19 or newer is required for ESM/CommonJS interoperability |
| **Scanned PDFs** | Image-based PDFs return empty text (no OCR) |
| **Large files** | PDF/XLSX load into RAM; use Max File Size to control |

---

## License

[MIT](LICENSE) © mazix

---

## Links

- [npm](https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents)
- [GitHub](https://github.com/mazixs/n8n-node-converter-documents)
- [Changelog](CHANGELOG.md)
