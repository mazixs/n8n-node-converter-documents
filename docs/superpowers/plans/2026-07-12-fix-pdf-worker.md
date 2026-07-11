# PDF Worker Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent clean n8n installations from resolving an incompatible OfficeParser/PDF.js combination and verify real PDF extraction before release.

**Architecture:** Keep the existing `officeparser` integration, but replace its floating dependency range with the last lock-file-proven compatible version. Add one package-resolution regression test and one real-file integration test so both installation metadata and PDF behavior are covered.

**Tech Stack:** TypeScript 5.8, Jest 30 with ts-jest, npm, OfficeParser 6.0.4, GitHub Actions.

## Global Constraints

- Preserve the current `extractViaOfficeParser(buffer): Promise<string>` interface.
- Do not alter non-PDF document strategies.
- Release as patch version `1.2.3`.
- Run all checks on Node.js 22-compatible dependencies.

---

### Task 1: Dependency and PDF regression coverage

**Files:**
- Create: `test/unit/dependency-versions.test.ts`
- Create: `test/integration/pdf-real-file.test.ts`

**Interfaces:**
- Consumes: root `package.json`, installed `officeparser/package.json`, and `extractViaOfficeParser(Buffer)`.
- Produces: regression checks that fail when OfficeParser floats or real PDF extraction breaks.

- [x] **Step 1: Add the dependency test**

Read both package manifests using `fs.readFileSync`. Assert that `dependencies.officeparser` contains only an exact semantic version and equals the installed OfficeParser version.

- [x] **Step 2: Run the dependency test and verify RED**

Run: `npm test -- --runInBand test/unit/dependency-versions.test.ts`

Expected: FAIL because the project currently declares `^6.0.4`.

- [x] **Step 3: Add the real PDF integration test**

Read `test/samples/sample3.pdf`, call the real `extractViaOfficeParser`, and assert that the returned text is non-empty.

- [x] **Step 4: Run the real PDF test**

Run: `npm test -- --runInBand test/integration/pdf-real-file.test.ts`

Expected: PASS with OfficeParser 6.0.4 from the existing lock file.

### Task 2: Pin the compatible dependency and prepare release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: exact OfficeParser version required by Task 1.
- Produces: npm package version `1.2.3` with deterministic OfficeParser resolution.

- [x] **Step 1: Pin OfficeParser**

Change `officeparser` from `^6.0.4` to `6.0.4` and regenerate the lock file with npm.

- [x] **Step 2: Verify GREEN**

Run both new Jest files and confirm they pass.

- [x] **Step 3: Bump and document the release**

Set the package version to `1.2.3` without creating a Git tag. Add a changelog entry explaining the floating dependency root cause and real PDF regression test.

### Task 3: Validate and publish

**Files:**
- Verify all changed files and generated npm archive.

**Interfaces:**
- Consumes: release-ready repository at version `1.2.3`.
- Produces: verified GitHub release and npm package.

- [x] **Step 1: Run verification**

Run: `npm run lint && npm run build && npm test -- --runInBand && npm run test:coverage -- --runInBand && npm pack --dry-run`

Expected: every command exits successfully and the archive contains the compiled node entry point and icon.

- [ ] **Step 2: Commit and push**

Commit only the plan, tests, dependency manifests, and changelog. Merge the release branch to `main`, push `main`, and wait for the GitHub release workflow to succeed.

- [ ] **Step 3: Publish to npm**

Run `npm publish --access public`, then verify `npm view @mazix/n8n-nodes-converter-documents@1.2.3 version` returns `1.2.3`.
