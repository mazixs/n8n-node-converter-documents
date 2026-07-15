# GitHub Actions Workflows

## Workflows

### 1. CI (`ci.yml`)
**Triggers:** push/PR to `main`, `develop`

Lint → Build → Test → Security Audit

### 2. Auto Release (`auto-release.yml`)
**Trigger:** push to `main` with a new version in `package.json`

1. Runs CI checks
2. Checks if version changed (compares with git tags)
3. Creates git tag `vX.Y.Z`
4. Creates GitHub Release with auto-generated release notes

> **npm publish is done manually.**

### 3. npm Publish (`publish-npm.yml`)

**Trigger:** manual workflow dispatch with an existing release version.

Checks out the matching `vX.Y.Z` tag, verifies the package version, runs lint/build/tests, and publishes through the repository `NPM_TOKEN` secret.

## How to release

```bash
# 1. Bump version
npm version patch  # or minor / major

# 2. Push to main
git push origin main --follow-tags

# 3. Wait for CI + GitHub Release

# 4. Run the "Publish to npm" workflow with the released version
gh workflow run publish-npm.yml -f version=1.3.0
```

## Local verification

```bash
npm run lint
npm run build
npm test
```
