# 🧹 Очистка dist/ из Git

## Проблема

Файлы `dist/` закоммичены в git, хотя `dist/` в `.gitignore`. Это legacy проблема — файлы были добавлены до обновления `.gitignore`.

## Почему это проблема

1. ❌ **Build артефакты не должны версионироваться** — они генерируются автоматически
2. ❌ **Конфликты при merge** — разные разработчики могут иметь разные версии dist/
3. ❌ **Большой размер репозитория** — dist/ файлы дублируются при каждом коммите
4. ❌ **Сложность review** — diff'ы содержат скомпилированный код

## ✅ Правильная схема

```
Git:        src/ → tracked ✅
            dist/ → ignored ✅

npm pack:   src/ → excluded ✅
            dist/ → included ✅
```

## 🔧 Решение

### Шаг 1: Проверка текущего состояния

```bash
# Посмотрите, какие файлы в dist/ отслеживаются git
git ls-files dist/

# Вывод:
# dist/FileToJsonNode.node.d.ts
# dist/FileToJsonNode.node.js
# dist/FileToJsonNode.node.js.map
# dist/errors.d.ts
# dist/errors.js
# dist/errors.js.map
# dist/helpers.d.ts
# dist/helpers.js
# dist/helpers.js.map
```

### Шаг 2: Удалить из git (но оставить локально)

```bash
cd /home/mazix/Документы/GitHub/n8n-node-converter-documents

# Удалить dist/ из git index, НО сохранить локальные файлы
git rm -r --cached dist/

# Проверить что файлы еще есть локально
ls -la dist/

# Должны увидеть: Untracked files: dist/
git status
```

### Шаг 3: Коммит изменений

```bash
git add .gitignore
git commit -m "chore: Remove dist/ from git tracking

- dist/ files are build artifacts and should not be versioned
- .gitignore already contains dist/ rule
- Files were previously committed before .gitignore update
- Local dist/ files remain intact for development
- npm package will still include dist/ via .npmignore rules"
```

### Шаг 4: Проверка

```bash
# dist/ больше не должен отслеживаться
git ls-files dist/
# (должно быть пусто)

# Но файлы остались локально
ls dist/
# FileToJsonNode.node.js  errors.js  helpers.js  icon.svg  ...
```

### Шаг 5: Пересборка для уверенности

```bash
npm run build
```

---

## 📦 Как это влияет на npm пакет?

**НЕ ВЛИЯЕТ!** 

`.npmignore` контролирует, что попадает в npm пакет:
- ✅ `dist/` включается (НЕТ в .npmignore)
- ❌ `*.js.map` исключаются (ЕСТЬ в .npmignore)
- ❌ `src/` исключается (ЕСТЬ в .npmignore)

**При публикации в npm:**
```bash
npm pack
# Создаст: mazix-n8n-nodes-converter-documents-1.0.12.tgz

# Содержимое:
# ✅ dist/*.js
# ✅ dist/*.d.ts
# ✅ dist/*.svg
# ❌ dist/*.js.map (исключены)
# ✅ package.json
# ✅ README.md
# ✅ LICENSE
```

---

## 🚨 Важно для CI/CD

После этого изменения убедитесь, что:

1. **GitHub Actions** собирают dist/ перед публикацией:
   ```yaml
   - run: npm run build
   - run: npm publish
   ```

2. **Локальная разработка** требует сборки после `git clone`:
   ```bash
   git clone ...
   npm install
   npm run build  # ← обязательно!
   ```

---

## 📋 Проверочный список

После выполнения команд:

- [ ] `git ls-files dist/` возвращает пустой результат
- [ ] `ls dist/` показывает файлы локально
- [ ] `git status` показывает clean working tree
- [ ] `npm pack` создает пакет с dist/ файлами
- [ ] `.github/workflows/release.yml` содержит `npm run build`

---

## 🔄 Если что-то пошло не так

### Вернуть файлы в git:
```bash
git reset HEAD~1  # отменить последний коммит
git add dist/
git commit -m "Revert: restore dist/ tracking"
```

### Восстановить локальные файлы:
```bash
npm run build  # пересоздать dist/
```

---

**Дата:** 2025-10-09
**Версия проекта:** 1.0.12
**Статус:** Готово к выполнению
