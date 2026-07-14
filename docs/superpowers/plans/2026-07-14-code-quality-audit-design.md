# Code Quality Audit Design

## Scope

Preserve the public n8n node contract while improving correctness, maintainability, and dependency safety. The aggregate output remains `{ files, totalFiles, processedAt }`; supported document formats and DOCX output modes remain unchanged.

## Execution flow

Each input follows one explicit sequence:

1. validate item and binary metadata;
2. load and validate the buffer;
3. resolve a supported format from the name or content;
4. execute the selected strategy;
5. validate the strategy result;
6. attach metadata;
7. log completion.

Failures stop the item before the completion state. The aggregate output keeps links to all source items.

## Internal contracts

Strategies return exactly one of `{ text, warning? }` or `{ sheets, warning? }`. Metadata belongs to the orchestration layer, not strategies. The strategy registry is the single source of truth for supported extensions.

The concurrency helper uses a bounded worker loop with stable result ordering and rejects invalid concurrency values. CSV truncation is reported only when an extra row exists. Large text files use the same detected encoding as small files and are sliced directly rather than converted into a synthetic line stream.

## Cleanup and compatibility

Remove the unused Excel row limiter and redundant wrappers. HTML fragments fall back to root text when no `<body>` exists. Shared OfficeParser error handling replaces repeated branches while preserving format-specific messages.

Update vulnerable dependencies only after targeted real-file tests prove PDF, DOCX, XLSX, XML, and YML compatibility. Keep the current CommonJS build and supported Node runtime assumptions.
