# GitHub Actions Workflows

## Workflows

### 1. CI (`ci.yml`)
**Триггеры:** push/PR в `main`, `develop`

Lint → Build → Test → Security Audit

### 2. Auto Release (`auto-release.yml`)
**Триггер:** push в `main` с новой версией в `package.json`

1. Запускает CI
2. Проверяет, изменилась ли версия (сравнивает с git tags)
3. Создаёт git tag `vX.Y.Z`
4. Создаёт GitHub Release с автогенерированным changelog

> **npm publish выполняется вручную.**

## Как создать релиз

```bash
# 1. Обновить версию
npm version patch  # или minor / major

# 2. Запушить в main
git push origin main --follow-tags

# 3. Дождаться CI + GitHub Release

# 4. Опубликовать в npm вручную
npm publish --access public
```

## Локальная проверка

```bash
npm run lint
npm run build
npm test
```
