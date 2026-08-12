# n8n Document Converter

[![npm](https://img.shields.io/npm/v/@mazix/n8n-nodes-converter-documents.svg)](https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents)
[![CI](https://github.com/mazixs/n8n-node-converter-documents/actions/workflows/ci.yml/badge.svg)](https://github.com/mazixs/n8n-node-converter-documents/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Community node for converting documents into text or structured sheet data inside self-hosted n8n. Version 1.4.0 adds node version 6, bounded processing, ZIP-container checks, and optional local OCR for scanned PDFs. Version 1.4.2 fixes in-place updates from 1.2.2 in a running n8n process.

## Requirements and installation

- Node.js 22.22.0 or newer; CI covers Node.js 22 and 24.
- A self-hosted n8n installation that permits community nodes.

Install `@mazix/n8n-nodes-converter-documents` under **Settings → Community Nodes**, or run:

```bash
cd ~/.n8n
npm install @mazix/n8n-nodes-converter-documents
```

Restart n8n after a command-line installation. Optional OCR libraries are installed once with the package; selecting OCR in a workflow only activates them. For a smaller installation without OCR:

```bash
npm install --omit=optional @mazix/n8n-nodes-converter-documents
```

## Supported formats

| Group | Formats | Result |
| --- | --- | --- |
| Documents | DOCX, ODT, PDF, TXT | Text; DOCX also supports HTML and Markdown |
| Spreadsheets | XLSX, ODS, CSV | Named sheets with row objects |
| Presentations | PPTX, ODP | Extracted text |
| Data and web | JSON, XML, YML, HTML, HTM | Text or normalized JSON text |

Legacy binary DOC/PPT files are detected but rejected with migration guidance; save them as DOCX/PPTX first.

## Node version 6

Version 6 emits one n8n item for every input file, preserves order and `pairedItem`, and keeps the original `item.json`. Conversion data is placed under `json.document`:

```json
{
  "requestId": "a-17",
  "document": {
    "status": "success",
    "text": "Extracted text",
    "warnings": [],
    "metadata": {
      "fileName": "report.pdf",
      "fileType": "pdf",
      "declaredFileType": "pdf",
      "detectedMime": "application/pdf"
    }
  }
}
```

The source binary is omitted unless **Keep Source Binary** is enabled. With **Continue On Fail**, failed inputs remain in the ordered output with `status: "error"` and an error `stage`, `code`, `message`, and `fileName`. Otherwise n8n receives a `NodeOperationError`.

The processing state machine is `validate → detect → check limits → parse → OCR decision → normalize → emit`. Signature detection takes precedence over a misleading extension and records a warning.

### Migrating from version 5

Existing workflows remain on node version 5 and retain its single aggregate `{ files, totalFiles, processedAt }` output. Add a fresh node or select version 6, then update expressions from `$json.files[...]` to `$json.document`. Review downstream item batching and enable **Keep Source Binary** only when needed.

## Limits and output controls

Version 6 exposes **Advanced Options** for input size, file concurrency, CSV/XLSX rows, TXT and result characters, ZIP entries, expanded archive size, and compression ratio. A value of `0` disables the workflow-level limit where shown. Conservative defaults protect memory; increasing or disabling them transfers resource control to the n8n administrator.

JSON defaults to **Preserve Structure**. Use **Flatten** to convert nested keys to dotted paths. Office ZIP containers are inspected without extraction for traversal paths, entry count, expanded bytes, and per-entry/archive compression ratios.

## OCR for scanned PDFs

OCR is local and disabled by default. Choose **When No Text Found** to run it only after normal PDF extraction returns no text, or **Always** to force it. The engine is `tesseract.js`; PDF pages are rendered locally through a PDF.js-compatible renderer. Configure languages such as `rus+eng`, render scale, page limit, per-page timeout, and OCR concurrency. Keep OCR concurrency at `1` unless the host has ample CPU and RAM.

The first run may download language models. Tesseract caches them when its environment permits; set an absolute **Cache Path** for predictable persistence. For an offline host, place compatible language data on disk and set **Language Data Path** to its absolute directory. HTTPS model locations are accepted, but only trusted administrator-controlled URLs should be used. One worker is reused per PDF and terminated after success, failure, or timeout.

OCR can consume substantial CPU and RAM, especially for high-resolution or multi-page scans. It is intended for self-hosted n8n, not constrained shared instances. PaddleOCR is not bundled: its official JavaScript package is currently browser-oriented, while the main runtime requires Python/PaddlePaddle. The internal engine interface leaves room for a future Node.js-compatible adapter.

## Troubleshooting

- `OCR_UNAVAILABLE`: reinstall without `--omit=optional` and restart n8n.
- Missing language model: verify the language code and model directory/HTTPS location.
- `OCR_TIMEOUT`: lower scale/pages or raise the page timeout cautiously.
- `ARCHIVE_LIMIT_EXCEEDED`: inspect the document before increasing ZIP limits.
- Empty PDF text with OCR disabled: select **When No Text Found**.
- Large output: adjust **Max Output Characters** or process files in smaller batches.

## Development and verification

```bash
npm ci                  # reproducible dependency install
npm run lint            # ESLint 10
npm run typecheck       # TypeScript 5.9 without output
npm run test:coverage   # Jest suite and coverage gates
npm run build           # clean dist/ and compile the node
npm run verify:package  # inspect the npm archive contents
```

`npm run test:ocr-smoke` enables the real OCR smoke test and may download the English model. Normal CI uses deterministic OCR mocks. See [AGENTS.md](AGENTS.md) for contribution rules and [.github/workflows/README.md](.github/workflows/README.md) for release instructions.

## Security

Parsing untrusted documents is resource-sensitive. Keep size and archive limits enabled, restrict community-node installation and OCR model configuration to trusted administrators, and do not retain source binaries unless downstream nodes require them. Report vulnerabilities privately through the repository's GitHub security advisory feature.

## License

[MIT](LICENSE) © mazix
