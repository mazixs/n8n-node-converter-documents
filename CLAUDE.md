# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the contributor rules (style, commit format, PR expectations) and is authoritative for those. This file covers the architecture and the traps that are not visible from a single file.

## Commands

```bash
npm ci                    # locked install, includes optional OCR deps
npm run build             # rimraf dist + tsc + copy icon.svg and the two CJS bridges
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint 10 (flat config, no-explicit-any is an error)
npm test                  # Jest
npm run test:coverage     # coverage gates (global + per-file thresholds)
npm run test:ci           # lint + typecheck + coverage + build — run before any PR
npm run verify:package    # npm pack --dry-run, checks the published archive
```

Single test file / single case:

```bash
npx jest test/unit/helpers.test.ts
npx jest test/integration/pdf-real-file.test.ts -t "extracts text"
```

Real OCR (downloads a language model, excluded from CI): `npm run test:ocr-smoke`.

Node.js 22.22.0 or newer (`.nvmrc`, `engines`); CI matrix is 22.22.0 and 24.

## Architecture

Single n8n community node, `ConvertFileToJson` (`src/ConvertFileToJson.node.ts`), published as `dist/ConvertFileToJson.node.js`.

### Two live node versions

`version: [5, 6]` and `execute()` dispatches on `this.getNode().typeVersion`: `>= 6` delegates to `executeV6` in `src/pipeline/v6.ts`, otherwise the v5 body inside the node file runs. Both paths are user-facing and must keep working.

- v5 returns one aggregate item: `{ files: [...], totalFiles, processedAt }`, hardcoded limits.
- v6 returns one item per input file, preserves order and `pairedItem`, merges into the original `item.json` under `json.document`, and exposes limits through **Advanced Options**.

Parameters are gated per version with `displayOptions: { show: { '@version': [5] } }` / `[6]`. A new parameter must declare which version it belongs to, and v6 reads it via `getNodeParameter(..., index, default)` so old workflows keep working.

### v6 pipeline

`src/pipeline/v6.ts` is an explicit stage machine: `validate → detect → check_limits → parse → ocr_decision → normalize → emit`. The current `stage` is tracked in a mutable local and attached to every failure, so a new step means a new `PipelineStage` member plus tests.

Errors are normalized into `PipelineFailure { stage, code, fileName, cause }`. `converterErrorCode()` maps the classes in `src/errors.ts` and the code-carrying `ArchiveValidationError` / `OcrError` onto stable machine-readable codes (`FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `EMPTY_CONTENT`, `INVALID_INPUT`, `OUTPUT_LIMIT_EXCEEDED`, `PROCESSING_FAILED`, `ARCHIVE_*`, `OCR_*`). These codes are part of the public contract — users branch on them; do not rename them. With `continueOnFail()` the failure becomes `document.status: "error"` in the ordered output; otherwise it is wrapped in `NodeOperationError` with `itemIndex`.

Detection: signature detection (`fileTypeFromBuffer`) wins over the declared extension when the detected type is a registered strategy, and the mismatch is pushed into `warnings`. Files are processed through `promisePool` at `maxConcurrency`; OCR is additionally throttled by a `Semaphore`.

### Format strategies

`src/strategies/index.ts` exports one object `satisfies Record<string, StrategyFn>`. The object key *is* the extension — `isSupportedFormat()` is a `hasOwnProperty` check against it, so adding a key is the whole registration step (`md`, `markdown`, `htm` are separate keys pointing at the same handler). A strategy returns either `{ text }` or `{ sheets }` plus an optional `warning`; `isStrategyResult()` enforces exactly one of the two.

Specialized handling lives outside this file: Yandex Market YML in `src/processors/yml.ts`, ZIP-container checks in `src/security/archive.ts`, OCR in `src/ocr/`.

DOCX has a deliberate fallback chain: mammoth HTML (→ `node-html-markdown` for markdown output), then officeparser, then `mammoth.extractRawText`, and only then a `ProcessingError`. Legacy binary DOC/PPT are detected by the CFB signature and rejected with migration guidance rather than parsed.

### ZIP container validation

Office/OpenDocument inputs (`docx xlsx pptx odt ods odp`) go through `validateZipArchive()` before parsing. It reads the central directory with `yauzl` in lazy-entry mode and never extracts — it checks traversal paths, entry count, cumulative uncompressed bytes, and both per-entry and whole-archive compression ratios. `exceeds()` treats a limit of `0` as disabled, which is how "0 = no limit" reaches the user-facing options.

### CommonJS build vs ESM-only dependencies

`tsconfig` targets `commonjs` with `allowJs: false`, but `file-type`, `pdf-to-img` and `tesseract.js` are ESM-only. Two hand-written CJS bridges keep the dynamic `import()` native so TypeScript cannot rewrite it to `require()`:

- `src/file-type-loader.js` + `src/file-type-loader.d.ts`
- `src/ocr/loader.js` + `src/ocr/loader.d.ts`

They are not compiled — the `build` script copies them (and `icon.svg`) with `fs.cpSync`. **Any new `.js`/asset under `src/` must be added to that `cpSync` list in `package.json`, or it silently vanishes from `dist/`.**

Three dependencies are installed under npm aliases (`file-type-modern`, `officeparser-modern`, `node-html-parser-modern`). The alias gives a fresh package-resolution key so Node's stale package metadata does not resolve n8n's older copy after an in-place community-package update. `test/unit/dependency-versions.test.ts` pins the alias strings and versions; changing them requires updating that test knowingly.

### PDF.js worker isolation

`src/helpers.ts` is where the in-place-update bugs from 1.4.3–1.4.5 were fixed (see `docs/`). PDF parsing goes through `extractViaOfficeParser(buffer, true)`, which serializes all PDF work on a module-level `pdfParseQueue`, temporarily clears `globalThis.pdfjsWorker`, refreshes PDF.js's internal `PDFWorker._setupFakeWorkerGlobal` cache, and passes an explicit resolved `pdfWorkerSrc`. Touching this file risks reintroducing "PDF worker mismatch after n8n update" — cover changes with `test/integration/in-place-update-load.test.ts`.

### OCR

Local, off by default, PDF-only. `src/ocr/index.ts` defines the `OcrEngine` interface and the `TesseractOcrEngine` implementation; the interface exists so a future non-Tesseract adapter can be dropped in. Dependencies are optional and loaded lazily, so a missing install surfaces as `OCR_UNAVAILABLE` instead of a crash. One worker per PDF, terminated on success, failure, or timeout. Unit tests must mock rendering and recognition; real model downloads belong only in the gated smoke test.

## Constraints worth knowing

- `dist/` and `coverage/` are generated. Never edit `dist/` by hand.
- Coverage is enforced per file, not just globally (`jest.config.js`): `pipeline/v6.ts`, `security/archive.ts` and `ocr/index.ts` carry the strictest thresholds, so new code there needs tests or `test:coverage` fails.
- `@typescript-eslint/no-explicit-any` is an error; unused names must be prefixed `_`.
- Pushing a bumped `package.json` version to `main` is a release action: `auto-release.yml` tags it, creates the GitHub Release, and `publish-npm.yml` publishes to npm via Trusted Publishing (OIDC, no token). Do not bump the version unless a release is intended.
- Source comments and `docs/` are partly Russian, README/AGENTS.md are English, and user-facing strings mix both. Match the surrounding file.
