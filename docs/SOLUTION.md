# Technical Solution Overview

## Architecture Overview

This n8n community node implements a hybrid document processing architecture using the strategy pattern with format-specific processors and intelligent fallbacks.

### Core Architecture Components

1. **Main Node Implementation** (`FileToJsonNode.node.ts`)
   - Strategy pattern for format-specific processing
   - Custom error hierarchy for different failure modes
   - Promise pooling for concurrent processing
   - Input validation and sanitization

2. **Helper Functions** (`helpers.ts`)
   - Document extraction utilities
   - Excel sheet limiting for performance
   - Backward compatibility functions

3. **Error Classes** (`errors.ts`)
   - Custom error types extending base Error
   - Specific error handling for different scenarios

## Dependency Management Solutions

### Processing Strategy Implementation

The node uses a hybrid approach with primary and fallback processors:

```typescript
const strategies: Record<string, (buf: Buffer, ext?: string) => Promise<Partial<JsonResult>>> = {
  docx: async (buf) => {
    try {
      return { text: await extractViaOfficeParser(buf) };
    } catch (error) {
      // Fallback to mammoth if officeparser fails
      const result = await mammoth.extractRawText({ buffer: buf });
      return { text: result.value };
    }
  },
  // ... other strategies
};
```

### Error Handling Architecture

Custom error classes provide specific handling for different failure scenarios:

- `FileTypeError` - Invalid file types or missing binary data
- `FileTooLargeError` - Files exceeding size limits
- `UnsupportedFormatError` - Legacy formats (DOC, PPT) or unknown types
- `EmptyFileError` - Empty files or no extractable content
- `ProcessingError` - General processing failures

## Installation Solutions

### 1. Standalone Version (Recommended)

Create a standalone version with its own package.json:

```bash
# Clone the repository
git clone https://github.com/mazix/n8n-node-converter-documents.git
cd n8n-node-converter-documents

# Install dependencies and create standalone version
npm install
npm run standalone

# Copy to n8n
cp -r ./standalone ~/.n8n/custom-nodes/n8n-node-converter-documents
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
npm install

# Restart n8n
```

### 2. Using npm Package

```bash
# In n8n project folder
npm install @mazix/n8n-nodes-converter-documents
```

### 3. Manual Dependency Installation

```bash
# Copy files
mkdir -p ~/.n8n/custom-nodes/n8n-node-converter-documents
cp dist/* ~/.n8n/custom-nodes/n8n-node-converter-documents/
cp package.json ~/.n8n/custom-nodes/n8n-node-converter-documents/

# Install dependencies
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
npm install --production
```

### 4. Global Installation

```bash
# Install dependencies globally
npm install -g chardet cheerio exceljs file-type iconv-lite mammoth officeparser papaparse pdf-parse sanitize-html xml2js

# Copy only the main file
cp dist/FileToJsonNode.node.js ~/.n8n/custom-nodes/
```

## What the Standalone Version Does

The `create-standalone.js` script:
1. Creates `./standalone/` folder
2. Copies compiled files from `dist/`
3. Creates minimal `package.json` with runtime dependencies only
4. Adds README with installation instructions

## Standalone Version Structure

```
standalone/
├── FileToJsonNode.node.js  # Main node file
├── helpers.js              # Helper functions
├── errors.js               # Custom errors
├── package.json            # Runtime dependencies only
└── README.md               # Installation instructions
```

## Installation Verification

```bash
# Check files
ls -la ~/.n8n/custom-nodes/n8n-node-converter-documents/

# Check dependencies
cd ~/.n8n/custom-nodes/n8n-node-converter-documents/
npm list
```

## Published Package

Package available on npmjs.org:
- **Name**: `@mazix/n8n-nodes-converter-documents`
- **Version**: 1.0.11
- **Size**: 11.0 kB (9 files)

## Useful Commands

```bash
# Create standalone version
npm run standalone

# Build project
npm run build

# Run tests
npm test

# Check package
npm pack --dry-run
```

The standalone version is the most reliable way to solve dependency issues in n8n custom nodes. 