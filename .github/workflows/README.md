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

## How to release

```bash
# 1. Bump version
npm version patch  # or minor / major

# 2. Push to main
git push origin main --follow-tags

# 3. Wait for CI + GitHub Release

# 4. Publish to npm manually
npm publish --access public
```

## Local verification

```bash
npm run lint
npm run build
npm test
```
