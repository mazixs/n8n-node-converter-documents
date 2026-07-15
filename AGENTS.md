# Repository Guidelines

## Project Structure & Module Organization

The n8n node entry point is `src/ConvertFileToJson.node.ts`. Version 6 orchestration and its explicit state machine live in `src/pipeline/v6.ts`; format parsers are registered in `src/strategies/index.ts`. Keep OCR adapters in `src/ocr/`, archive validation in `src/security/`, Yandex Market handling in `src/processors/`, and reusable helpers in `src/utils/`. Tests mirror behavior under `test/unit/` and `test/integration/`; reusable documents belong in `test/samples/`. Compiled files are generated in `dist/` and must not be edited manually.

## Build, Test, and Development Commands

- `npm ci` installs the locked dependency graph, including optional OCR libraries.
- `npm run build` removes stale output, compiles TypeScript, and copies the node icon.
- `npm run typecheck` checks strict TypeScript without emitting files.
- `npm run lint` applies the ESLint 10 rules.
- `npm test` runs Jest; `npm run test:coverage` enforces coverage thresholds.
- `npm run verify:package` previews the exact npm archive.
- `npm run test:ocr-smoke` runs real local OCR and may download a model.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, single quotes, semicolons, and explicit types at module boundaries. Name classes and interfaces in PascalCase, functions and variables in camelCase, and tests `*.test.ts`. Keep each format behind the shared `StrategyFn` contract. Add new processing states or errors through the typed FSM and return stable machine-readable error codes. Avoid hidden limits: expose safe, user-adjustable controls in node parameters.

## Testing Guidelines

Write a failing regression test before changing behavior. Preserve version 5 characteristic tests and add version 6 tests for ordering, `pairedItem`, failure mode, resource cleanup, and limits. OCR unit tests must mock rendering and recognition; keep network/model work in the gated smoke test. Global minimums are 80% lines/statements, 60% branches, and 85% functions; security and FSM modules have stricter file thresholds.

## Commit & Pull Request Guidelines

Follow the existing imperative, scoped style, for example `fix: reject unsafe ZIP paths` or `feat: add optional PDF OCR`. Keep commits focused. Pull requests must describe user-visible behavior, migration impact, tests run, and security/resource implications. Link relevant issues and include n8n screenshots when node parameters or output shape change. Before review, run `npm run test:ci`, both audits, and `npm run verify:package`.
