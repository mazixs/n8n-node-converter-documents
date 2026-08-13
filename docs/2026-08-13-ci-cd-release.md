# CI/CD и публикация community package

## Состояние до настройки

Репозиторий уже выполнял две независимые части процесса:

- `ci.yml` запускал проверки на Node.js 22.22 и 24 для push в `main`/`develop` и pull request;
- `auto-release.yml` после успешного CI создавал тег `vX.Y.Z` и GitHub Release, если такой тег ещё не существовал;
- `publish-npm.yml` запускался вручную и был настроен на Trusted Publishing, но не использовал секрет `NPM_TOKEN`.

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
  └─ npm publish --access public через NPM_TOKEN
```

Pull request запускает только CI и не может публиковать пакет. Повторная публикация запускается вручную:

```bash
gh workflow run publish-npm.yml -f version=1.4.5
gh run watch
```

## Секрет npm

В GitHub Actions используется секрет репозитория `NPM_TOKEN`. Для прямого `npm publish` при включённой 2FA это должен быть Granular Access Token с правами публикации именно для `@mazix/n8n-nodes-converter-documents` и включённым **Bypass 2FA**. Обычный токен может пройти настройку GitHub, но npm остановит публикацию с `EOTP`.

Workflow передаёт секрет npm как `NODE_AUTH_TOKEN` только шагу `npm publish`, который понимает `setup-node` и npm CLI. Права GitHub workflow ограничены `contents: read`; токен не хранится в Git и не выводится в summary.

## Проверка для `1.4.5`

Для коммита `17c8b0a` GitHub Actions подтвердил:

- CI: успешно;
- Auto Release: успешно;
- тег `v1.4.5`: создан;
- GitHub Release `v1.4.5`: создан.

После добавления или обновления `NPM_TOKEN` нужно запустить ручной workflow для публикации уже созданного тега `v1.4.5`. Следующие новые версии будут публиковаться автоматически после прохождения CI и создания GitHub Release.

Для `1.4.5` первый запуск дошёл до npm, но получил `EOTP`: существующий секрет оказался обычным токеном без обхода 2FA. После замены значения `NPM_TOKEN` на Granular Access Token с **Bypass 2FA** этот же workflow можно безопасно повторить.

Порядок проверок в publish workflow намеренно повторяет CI: сначала создаётся `dist`, затем запускаются тесты. Это важно для интеграционного теста in-place update, который загружает собранный пакет из `dist` на чистом runner.
