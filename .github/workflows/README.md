# Release Workflows

## CI

`ci.yml` runs on pushes and pull requests to `main` and `develop`. Its Node.js 22.22/24 matrix performs a clean install, production dependency audit, lint, build, typecheck, coverage tests, and npm archive inspection.

## GitHub release

`auto-release.yml` runs after a push to `main`. If `package.json` contains a version without an existing `vX.Y.Z` tag, it waits for CI, creates and pushes the tag, and creates the GitHub Release.

## npm publication

`publish-npm.yml` is the reusable publication workflow. After `auto-release.yml` creates a new GitHub Release, it checks out the matching tag, verifies and tests it on Node.js 24, runs the production audit and npm archive check, and publishes the package through npm Trusted Publishing.

The package is configured on npmjs.com under **Trusted Publisher → GitHub Actions**:

- organization/user: `mazixs`;
- repository: `n8n-node-converter-documents`;
- workflow filename: `auto-release.yml`;
- environment: empty;
- allowed action: `npm publish`.

Both `auto-release.yml` and the called `publish-npm.yml` grant `id-token: write`. npm CLI 11.5.1 or newer is installed in the publishing workflow. No `NPM_TOKEN` is required.

The pull request and push CI remains separate from publication: it runs the Node.js 22.22/24 matrix, audit, lint, build, typecheck, coverage, and archive checks. A push to `main` then follows this order:

```text
push main
→ CI matrix succeeds
→ package version has no matching vX.Y.Z tag
→ auto-release creates tag and GitHub Release
→ publish-npm verifies the tag and publishes to npm through OIDC
```

For the current release or a retry after a failed publication, run the caller workflow with the existing-tag switch:

```bash
gh workflow run auto-release.yml -f publish_existing=true
gh run watch
```

## Manual npm publication

Use this only when GitHub Actions or Trusted Publishing is unavailable:

```bash
npm whoami
npm run test:ci
npm audit --omit=dev
npm pack --dry-run
npm publish --access public --otp=<code>
```

The manual command is a local fallback when GitHub Actions is unavailable. Do not place tokens or one-time codes in repository files, shell history, or workflow logs.
