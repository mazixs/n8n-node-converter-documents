# Release Workflows

## CI

`ci.yml` runs on pushes and pull requests to `main` and `develop`. Its Node.js 22.22/24 matrix performs a clean install, production dependency audit, lint, build, typecheck, coverage tests, and npm archive inspection.

## GitHub release

`auto-release.yml` runs after a push to `main`. If `package.json` contains a version without an existing `vX.Y.Z` tag, it waits for CI, creates and pushes the tag, and creates the GitHub Release.

## npm Trusted Publishing

`publish-npm.yml` is a manually dispatched release workflow. It checks out the requested tag, verifies and tests it on Node.js 24, updates npm to a Trusted Publishing-compatible version, and publishes without a stored token.

Configure the package on npmjs.com under **Settings → Trusted Publisher**:

- provider: GitHub Actions;
- organization/user: `mazixs`;
- repository: `n8n-node-converter-documents`;
- workflow filename: `publish-npm.yml`;
- allowed action: `npm publish`.

The workflow has `id-token: write`; npm exchanges that OIDC identity for a short-lived credential. Two-factor authentication stays enabled, but no `NPM_TOKEN` or one-time code is needed in CI. GitHub-hosted runners and npm CLI 11.5.1 or newer are required.

After the GitHub release exists:

```bash
gh workflow run publish-npm.yml -f version=1.4.0
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

The extra code is the npm two-factor authentication one-time password required for an interactive publish. Do not place tokens or one-time codes in repository files, shell history, or workflow logs.
