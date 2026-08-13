# Release Workflows

## CI

`ci.yml` runs on pushes and pull requests to `main` and `develop`. Its Node.js 22.22/24 matrix performs a clean install, production dependency audit, lint, build, typecheck, coverage tests, and npm archive inspection.

## GitHub release

`auto-release.yml` runs after a push to `main`. If `package.json` contains a version without an existing `vX.Y.Z` tag, it waits for CI, creates and pushes the tag, and creates the GitHub Release.

## npm publication

`publish-npm.yml` is the reusable publication workflow. After `auto-release.yml` creates a new GitHub Release, it checks out the matching tag, verifies and tests it on Node.js 24, runs the production audit and npm archive check, and publishes the package.

The workflow authenticates through the repository secret `NPM_TOKEN`. Configure it in GitHub under **Settings → Secrets and variables → Actions → New repository secret**. The token must have publish access to `@mazix/n8n-nodes-converter-documents` and be compatible with the npm account's two-factor authentication policy.

The token is passed only as `NODE_AUTH_TOKEN` to the npm publish job. It is not stored in the repository, written to source files, or printed in the workflow summary. The workflow grants only `contents: read`.

The pull request and push CI remains separate from publication: it runs the Node.js 22.22/24 matrix, audit, lint, build, typecheck, coverage, and archive checks. A push to `main` then follows this order:

```text
push main
→ CI matrix succeeds
→ package version has no matching vX.Y.Z tag
→ auto-release creates tag and GitHub Release
→ publish-npm verifies the tag and publishes to npm
```

For the current release or a retry after a failed publication:

```bash
gh workflow run publish-npm.yml -f version=1.4.5
gh run watch
```

## Manual npm publication

Use this only when Trusted Publishing is not configured:

```bash
npm whoami
npm run test:ci
npm audit --omit=dev
npm pack --dry-run
npm publish --access public --otp=<code>
```

The manual command is a local fallback when GitHub Actions is unavailable. Do not place tokens or one-time codes in repository files, shell history, or workflow logs.
