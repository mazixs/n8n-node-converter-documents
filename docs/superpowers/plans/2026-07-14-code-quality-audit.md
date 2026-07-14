# Code Quality Audit Implementation Plan

**Goal:** Improve the converter's execution logic, strategy contracts, concurrency, deduplication, and dependency safety without changing its public output shape.

**Architecture:** Keep the strategy registry and aggregate node output. Make orchestration transitions explicit through small helpers, strengthen TypeScript unions, and use a bounded worker-loop pool. Confirm every behavioral change with focused tests before implementation.

**Tech stack:** TypeScript, Jest, n8n-workflow, OfficeParser, fast-xml-parser, Papa Parse.

---

### Task 1: Lock down orchestration behavior

**Files:** `test/unit/FileToJsonNode.execute.test.ts`, `src/FileToJsonNode.node.ts`, `src/types.ts`

1. Add tests for malformed strategy results, logging order, format resolution, and aggregate pairing.
2. Run the focused test and confirm failures.
3. Introduce strict strategy/result types and extraction helpers.
4. Derive supported formats from the strategy registry and move completion logging after result validation.
5. Run the focused test and type-check.

### Task 2: Replace the concurrency state machine

**Files:** `test/unit/promisePool.test.ts`, `src/utils/promisePool.ts`

1. Add tests for stable ordering, concurrency bounds, rejection, empty input, and invalid limits.
2. Confirm the invalid-limit tests fail.
3. Replace recursive scheduling with bounded worker loops.
4. Run the focused test.

### Task 3: Correct and deduplicate strategies

**Files:** `test/unit/strategies.test.ts`, `test/unit/processHtml.test.ts`, `src/strategies/index.ts`

1. Add boundary tests for CSV truncation, large text encoding/truncation, and HTML fragments.
2. Confirm the new tests fail.
3. Replace pseudo-streaming text logic, fix the CSV boundary, reuse OfficeParser wrappers, and remove redundant HTML wrappers.
4. Statically import sheet-name reading and remove the no-op row limiter call.
5. Run strategy and real-file tests.

### Task 4: Remove rudimentary Excel limiting

**Files:** `src/helpers.ts`, `test/unit/helpers.test.ts`, `test/integration/xlsx-sheets.test.ts`, strategy mocks

1. Remove `limitExcelSheet` and tests that only exercise the unused option.
2. Update XLSX integration coverage to assert the actual strategy result.
3. Run helper and XLSX tests.

### Task 5: Simplify YML normalization

**Files:** `test/unit/yml-processor.test.ts`, `src/processors/yml.ts`

1. Add tests preserving boolean and numeric falsey values.
2. Confirm failures caused by `||` defaults.
3. Add shared scalar/array normalization and compute availability statistics in one pass.
4. Run YML tests.

### Task 6: Remediate dependencies safely

**Files:** `package.json`, `package-lock.json`, `test/unit/dependency-versions.test.ts`

1. Update vulnerable compatible packages and the OfficeParser pin.
2. Keep a regression assertion for the selected parser version.
3. Run all real-file tests, build, and production dependency audit.
4. Revert any dependency update that breaks the CommonJS worker path.

### Task 7: Full verification and self-review

1. Run lint, build, all tests, coverage, duplication detection, and production audit.
2. Review the complete diff for public-contract changes, error paths, and dead code.
3. Fix findings and repeat affected checks.
4. Summarize remaining risks and measured improvements.
