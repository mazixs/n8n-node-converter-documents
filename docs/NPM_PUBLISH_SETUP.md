# 📦 Настройка автоматической публикации в npm

**Версия:** 1.0  
**Дата:** 2025-10-09  
**Статус:** CI/CD настроен, требуется добавить NPM_TOKEN

---

## 🎯 Что сделано

Добавлен новый job `publish-npm` в `.github/workflows/release.yml`, который автоматически публикует пакет в npm после создания GitHub Release.

### Процесс публикации:

```mermaid
1. Создается git tag (v1.0.12)
   ↓
2. GitHub Actions запускается
   ↓
3. Job: test - Прогоняет тесты
   ↓
4. Job: release - Создает GitHub Release
   ↓
5. Job: publish-npm - Публикует в npm ✨ НОВОЕ
   ↓
6. Job: notify - Уведомление о результате
```

---

## 🔑 Необходима настройка NPM_TOKEN

Для работы автоматической публикации нужно добавить NPM токен в GitHub Secrets.

### Шаг 1: Создание NPM Access Token

1. **Войдите на npmjs.com:**
   - Перейдите на https://www.npmjs.com/
   - Войдите в свой аккаунт

2. **Создайте Granular Access Token (рекомендуется):**
   ```
   Профиль → Access Tokens → Generate New Token → Granular Access Token
   
   Настройки токена:
   ┌─────────────────────────────────────────────┐
   │ Token name: GitHub Actions CI/CD            │
   │ Expiration: 365 days (или другой срок)      │
   │                                             │
   │ Packages and scopes:                        │
   │ ● Selected packages and scopes              │
   │   └─ @mazix/n8n-nodes-converter-documents   │
   │                                             │
   │ Permissions:                                │
   │ ☑ Read and write (для publish)             │
   │ ☐ Read only                                 │
   │                                             │
   │ Organizations (если применимо):             │
   │ ☑ @mazix                                    │
   └─────────────────────────────────────────────┘
   
   Кнопка: Generate Token
   ```

3. **⚠️ ВАЖНО: Скопируйте токен сразу!**
   ```
   Токен показывается только один раз:
   npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   
   Сохраните его в безопасное место!
   ```

### 🔀 Альтернатива: Classic Token (НЕ рекомендуется)

```
Если по какой-то причине нужен Classic Token:

Профиль → Access Tokens → Generate New Token → Classic Token

Тип: Automation

⚠️ Недостатки Classic Token:
- Полный доступ ко ВСЕМ пакетам аккаунта
- Нельзя ограничить конкретным пакетом
- Нельзя установить срок действия
- Менее безопасно для CI/CD
```

---

### Шаг 2: Добавление токена в GitHub Secrets

1. **Откройте настройки репозитория:**
   ```
   GitHub → Ваш репозиторий → Settings → Secrets and variables → Actions
   ```

2. **Создайте новый секрет:**
   ```
   Кнопка: "New repository secret"
   
   Name: NPM_TOKEN
   Secret: [вставьте токен из шага 1]
   
   Кнопка: "Add secret"
   ```

3. **Проверьте:**
   ```
   Секрет должен появиться в списке:
   ✅ NPM_TOKEN (Updated X seconds ago)
   ```

---

## ✅ Проверка настройки

### Тестовый запуск:

```bash
# 1. Убедитесь что все изменения закоммичены
git status

# 2. Создайте тестовый тег (или используйте реальную версию)
git tag v1.0.12-test

# 3. Запушьте тег
git push origin v1.0.12-test

# 4. Проверьте GitHub Actions
# GitHub → Actions → Release Pipeline
```

### Что должно произойти:

```
✅ Run Tests Before Release - пройдут тесты
✅ Create GitHub Release - создастся релиз
✅ Publish to npm - опубликуется в npm 🎉
✅ Post-Release Notification - уведомление об успехе
```

---

## 📋 Структура workflow

### Job: publish-npm (новый)

```yaml
publish-npm:
  name: Publish to npm
  runs-on: ubuntu-latest
  needs: [test, release]
  if: github.ref_type == 'tag'
  
  steps:
    1. Checkout кода
    2. Setup Node.js с npm registry
    3. Установка зависимостей (npm ci)
    4. Сборка проекта (npm run build)
    5. Проверка dist/
    6. Проверка содержимого пакета (dry-run)
    7. Публикация в npm ← использует NPM_TOKEN
    8. Summary в GitHub Actions
```

### Что публикуется:

```
📦 @mazix/n8n-nodes-converter-documents@1.0.12

Содержимое (10 файлов, 20.4 KB):
✅ dist/FileToJsonNode.node.js
✅ dist/FileToJsonNode.node.d.ts
✅ dist/errors.js + errors.d.ts
✅ dist/helpers.js + helpers.d.ts
✅ dist/icon.svg
✅ package.json
✅ README.md
✅ LICENSE

❌ src/ (исключено)
❌ test/ (исключено)
❌ docs/ (исключено)
❌ *.js.map (исключено)
```

---

## 🚀 Процесс релиза (после настройки)

### Полностью автоматизированный:

```bash
# 1. Завершите разработку
git add .
git commit -m "feat: new feature"
git push origin main

# 2. Создайте и запушьте тег
git tag v1.0.13
git push origin v1.0.13

# 3. Всё остальное автоматически:
#    ✅ Тесты
#    ✅ GitHub Release
#    ✅ npm publish
#    ✅ Уведомления
```

### Результат:

- **GitHub:** https://github.com/mazixs/n8n-node-converter-documents/releases/v1.0.13
- **npm:** https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents/v/1.0.13

---

## ⚠️ Важные замечания

### 1. Токен с правильными правами

```
Тип токена: Automation (рекомендуется)
Или: Publish (минимальные права)

❌ НЕ используйте: Classic Token с полным доступом
```

### 2. Организация токена

Если пакет опубликован под организацией (`@mazix/`):
```
Убедитесь что токен имеет доступ к организации:
npmjs.com → Organizations → @mazix → Members → Access Tokens
```

### 3. Публичный доступ

Пакет публикуется с флагом `--access public`:
```bash
npm publish --access public
```

Это обязательно для scoped пакетов (`@mazix/...`), иначе npm попытается опубликовать как приватный.

### 4. Версионирование

```
⚠️ npm не позволяет перезаписать версию!

Если v1.0.12 уже опубликован:
❌ Нельзя опубликовать v1.0.12 снова
✅ Нужно создать v1.0.13
```

---

## 🔍 Диагностика проблем

### Проблема: "npm ERR! code E401"

**Причина:** Неверный или отсутствующий NPM_TOKEN

**Решение:**
1. Проверьте что секрет `NPM_TOKEN` создан в GitHub
2. Убедитесь что токен действителен на npmjs.com
3. Пересоздайте токен если нужно

---

### Проблема: "npm ERR! 403 Forbidden"

**Причина:** Нет прав на публикацию пакета

**Решение:**
```
1. Убедитесь что вы владелец пакета на npmjs.com
2. Для организации: проверьте права доступа
3. Используйте --access public для scoped пакетов
```

---

### Проблема: "npm ERR! code E409"

**Причина:** Версия уже существует

**Решение:**
```bash
# Увеличьте версию в package.json
npm version patch  # 1.0.12 → 1.0.13

# Создайте новый тег
git tag v1.0.13
git push origin v1.0.13
```

---

## 📊 Мониторинг публикаций

### GitHub Actions:

```
GitHub → Actions → Release Pipeline
↓
Выберите последний запуск
↓
Смотрите логи job "Publish to npm"
```

### npm registry:

```
https://www.npmjs.com/package/@mazix/n8n-nodes-converter-documents

Проверьте:
✅ Версия обновилась
✅ Дата публикации соответствует
✅ Файлы присутствуют (вкладка "Files")
```

---

## 🔒 Безопасность

### Рекомендации:

1. **Ротация токенов:**
   ```
   Меняйте NPM_TOKEN каждые 6-12 месяцев
   ```

2. **Минимальные права:**
   ```
   Используйте Automation токен (только publish)
   НЕ используйте токен с правами на удаление
   ```

3. **Аудит:**
   ```
   Регулярно проверяйте:
   npmjs.com → Access Tokens → Recent activity
   ```

4. **Секреты в GitHub:**
   ```
   НЕ записывайте токен в код
   НЕ логируйте токен в CI/CD
   Используйте только GitHub Secrets
   ```

---

## ✅ Checklist перед первой публикацией

- [ ] NPM токен создан на npmjs.com
- [ ] Токен добавлен в GitHub Secrets как `NPM_TOKEN`
- [ ] `.github/workflows/release.yml` обновлен
- [ ] Версия в `package.json` корректна
- [ ] Создан git tag (например, `v1.0.12`)
- [ ] Tag запушен в GitHub
- [ ] GitHub Actions запустился
- [ ] Проверен лог job "Publish to npm"
- [ ] Пакет появился на npmjs.com

---

## 📚 Дополнительные ресурсы

- **npm Tokens:** https://docs.npmjs.com/about-access-tokens
- **GitHub Actions Secrets:** https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **npm publish:** https://docs.npmjs.com/cli/v9/commands/npm-publish

---

**Дата создания:** 2025-10-09  
**Автор:** mazix  
**Версия документа:** 1.0
