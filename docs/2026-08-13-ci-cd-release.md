# CI/CD и публикация community package

## Состояние до настройки

Репозиторий уже выполнял две независимые части процесса:

- `ci.yml` запускал проверки на Node.js 22.22 и 24 для push в `main`/`develop` и pull request;
- `auto-release.yml` после успешного CI создавал тег `vX.Y.Z` и GitHub Release, если такой тег ещё не существовал;
- `publish-npm.yml` был настроен как вызываемый workflow, но публикация ещё использовала секрет `NPM_TOKEN`.

Из-за этого GitHub Release создавался автоматически, а npm-публикация оставалась отдельным ручным действием. Для `1.4.5` это было видно напрямую: CI и Auto Release завершились успешно, тег `v1.4.5` и GitHub Release появились, но npm требовал локальный OTP.

## Зафиксированная логика

Теперь поток выглядит так:

```text
push в main
  ↓
CI: Node.js 22.22 и 24
  ├─ npm ci
  ├─ production audit
  ├─ lint
  ├─ build
  ├─ typecheck
  ├─ coverage tests
  └─ проверка npm-архива
  ↓
auto-release
  ├─ читает version из package.json
  ├─ проверяет наличие v<version>
  ├─ создаёт тег и GitHub Release только для новой версии
  └─ передаёт version в publish-npm
  ↓
publish-npm
  ├─ checkout тега v<version>
  ├─ проверяет совпадение версии
  ├─ повторяет audit, CI-проверки и проверку архива
  └─ npm publish --access public через Trusted Publishing (OIDC)
```

Pull request запускает только CI и не может публиковать пакет. Повторная публикация существующей версии запускается через вызывающий workflow:

```bash
gh workflow run auto-release.yml -f publish_existing=true
gh run watch
```

## npm Trusted Publishing

В настройках пакета npm создан Trusted Publisher для GitHub Actions:

- organization/user: `mazixs`;
- repository: `n8n-node-converter-documents`;
- workflow filename: `auto-release.yml`;
- allowed action: `npm publish`.

Публикация использует OIDC. `id-token: write` выдан и вызывающему `auto-release.yml`, и вызываемому `publish-npm.yml`; npm CLI обновляется до версии 11.5.1 или новее. `NPM_TOKEN` больше не нужен и после успешной проверки может быть удалён из GitHub Secrets.

## Проверка для `1.4.5`

Для коммита `17c8b0a` GitHub Actions подтвердил:

- CI: успешно;
- Auto Release: успешно;
- тег `v1.4.5`: создан;
- GitHub Release `v1.4.5`: создан.

После настройки Trusted Publisher нужно запустить `auto-release.yml` с параметром `publish_existing=true` для публикации уже созданного тега `v1.4.5`. Следующие новые версии будут публиковаться автоматически после прохождения CI и создания GitHub Release.

Для `1.4.5` первый запуск на токене дошёл до npm, но получил `EOTP`. После настройки Trusted Publisher повторный запуск должен использовать OIDC и не требовать OTP или npm-токена.

Порядок проверок в publish workflow намеренно повторяет CI: сначала создаётся `dist`, затем запускаются тесты. Это важно для интеграционного теста in-place update, который загружает собранный пакет из `dist` на чистом runner.
