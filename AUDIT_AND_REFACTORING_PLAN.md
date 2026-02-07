# Аудит проекта n8n-node-converter-documents

**Дата:** 2026-02-07  
**Версия проекта:** 1.1.2  
**Целевая совместимость:** n8n 2.7.0 (n8n-workflow 1.120.8)

---

## 1. ЗАВИСИМОСТИ — ПОЛНЫЙ АУДИТ (данные из npm registry 2026-02-07)

### 1.1 Все dependencies — текущие vs актуальные

| Пакет | В проекте | Wanted | Latest | Последний релиз | Статус |
|-------|-----------|--------|--------|-----------------|--------|
| `exceljs` | ^4.4.0 | 4.4.0 | 4.4.0 | 2023-10-19 (2+ года!) | **ЗАМЕНИТЬ** — мейнтейнер в отпуске, нет обновлений, есть уязвимости в зависимостях |
| `fast-xml-parser` | ^4.3.4 | 4.5.3 | **5.3.4** | 2026-01-30 | **ОБНОВИТЬ** — major v5, активно развивается |
| `file-type` | 16.5.4 (pinned) | 16.5.4 | **21.3.0** | 2026-01-04 | Оставить 16.5.4 — v17+ ESM-only, несовместим с CommonJS |
| `iconv-lite` | ^0.6.3 | 0.6.3 | **0.7.2** | 2026-01-08 | **УДАЛИТЬ** — заменить на `chardet` + нативный `Buffer` |
| `jschardet` | ^3.0.0 | 3.1.4 | 3.1.4 | 2024-09-30 (1.5 года) | **УДАЛИТЬ** — заменить на `chardet` (2.1.1, обновлён 2025-10) |
| `jszip` | ^3.10.1 | 3.10.1 | 3.10.1 | — | **УДАЛИТЬ** — используется только в 3-м fallback DOCX |
| `mammoth` | ^1.9.1 | **1.11.0** | **1.11.0** | 2025-09-19 | **ОБНОВИТЬ ^1.11.0** |
| `node-html-parser` | ^6.1.12 | 6.1.13 | **7.0.2** | 2026-01-07 | **ОБНОВИТЬ ^7.0.2** — major, проверить breaking changes |
| `officeparser` | ^5.1.1 | 5.2.2 | **6.0.4** | 2026-01-10 | **ОБНОВИТЬ ^6.0.4** — major, проверить breaking changes |
| `papaparse` | ^5.5.3 | 5.5.3 | 5.5.3 | 2025-05-19 | Актуален ✅ |
| `sanitize-html` | ^2.17.0 | 2.17.0 | 2.17.0 | 2026-01-26 | **УДАЛИТЬ** — дубль, `node-html-parser` достаточно |

### 1.2 Все devDependencies — текущие vs актуальные

| Пакет | В проекте | Latest | Статус |
|-------|-----------|--------|--------|
| `@babel/core` | ^7.27.4 | — | **УДАЛИТЬ** — не используется (jest = ts-jest, webpack = compiled JS) |
| `@babel/preset-env` | ^7.27.2 | — | **УДАЛИТЬ** — не используется |
| `@eslint/js` | ^9.28.0 | — | Актуален ✅ |
| `@types/iconv-lite` | ^0.0.1 | 0.0.1 | **УДАЛИТЬ** — deprecated, iconv-lite имеет встроенные типы |
| `@types/jest` | ^30.0.0 | — | Актуален ✅ |
| `@types/jszip` | ^3.4.0 | — | **УДАЛИТЬ** — jszip имеет встроенные типы, сам jszip удаляется |
| `@types/node` | ^22.15.29 | — | Актуален ✅ |
| `@types/papaparse` | ^5.3.16 | **5.5.2** | **ОБНОВИТЬ ^5.5.2** (обновлён 2025-12-13) |
| `@types/sanitize-html` | ^2.16.0 | — | **УДАЛИТЬ** — вместе с sanitize-html |
| `audit-ci` | ^7.1.0 | — | **УДАЛИТЬ** — не вызывается в CI |
| `babel-loader` | ^10.0.0 | — | **УДАЛИТЬ** — не используется |
| `buffer` | ^6.0.3 | — | **УДАЛИТЬ** — browser polyfill, бесполезен для Node.js |
| `eslint` | ^9.28.0 | — | Актуален ✅ |
| `globals` | ^16.2.0 | — | Актуален ✅ (eslint.config.mjs) |
| `jest` | ^30.0.1 | — | Актуален ✅ |
| `n8n-workflow` | ^1.82.0 | — | **ОБНОВИТЬ ^1.120.8** (latest 2026-02-06) |
| `path-browserify` | ^1.0.1 | — | **УДАЛИТЬ** — browser polyfill |
| `rimraf` | ^6.0.1 | — | Актуален ✅ |
| `stream-browserify` | ^3.0.0 | — | **УДАЛИТЬ** — browser polyfill |
| `ts-jest` | ^29.4.0 | — | Актуален ✅ |
| `typescript` | ^5.8.3 | — | Актуален ✅ |
| `typescript-eslint` | ^8.33.1 | — | Актуален ✅ |
| `util` | ^0.12.5 | — | **УДАЛИТЬ** — browser polyfill |
| `webpack` | ^5.99.9 | — | **УДАЛИТЬ** — bundle/ не публикуется |
| `webpack-cli` | ^6.0.1 | — | **УДАЛИТЬ** — вместе с webpack |

### 1.3 Рудиментные dependencies (удалить)

| Пакет | Проблема | Действие |
|-------|----------|----------|
| `jschardet` + `iconv-lite` | **Дубль.** Detect+decode кодировки. `jschardet` — последний релиз 2024-09, `iconv-lite` 0.6.x устарел (0.7.2 вышел). Заменить на `chardet` (2.1.1, обновлён 2025-10) + нативный `Buffer.toString(encoding)` | **УДАЛИТЬ оба**, добавить `chardet` |
| `sanitize-html` | **Дубль.** `node-html-parser` парсит HTML → `.text`, затем `sanitize-html` очищает уже plain text. Избыточно. `sanitize-html` тянет htmlparser2, domhandler, etc. | **УДАЛИТЬ**, использовать `.textContent` из `node-html-parser` |
| `jszip` | Используется **только** в 3-м fallback DOCX (строка 437). `mammoth` + `officeparser` уже обрабатывают DOCX | **УДАЛИТЬ** |
| `mammoth` + `officeparser` | Частичный дубль. Оба парсят DOCX. Но `mammoth` нужен для DOCX→HTML | **ОСТАВИТЬ оба**, разделить: `mammoth` = HTML, `officeparser` = всё остальное |

### 1.4 Уязвимости и риски

| Проблема | Серьёзность | Действие |
|----------|-------------|----------|
| `exceljs` 4.4.0 — мейнтейнер в отпуске, 2+ года без стабильного релиза, уязвимости в зависимостях (ReDoS) | **HIGH** | **ЗАМЕНИТЬ** на `read-excel-file` (см. раздел 1.5) |
| `file-type` 16.5.4 — 2022, v17+ ESM-only | **MEDIUM** | Оставить (CJS constraint), добавить комментарий |
| `overrides.form-data >= 4.0.4` | **LOW** | Проверить при `npm audit`, удалить если не нужен |

---

### 1.5 РЕСЁРЧ: Замена exceljs

**Проблема:** `exceljs` 4.4.0 — последний стабильный релиз 2023-10-19. Мейнтейнер объявил отпуск. Есть prerelease 4.4.1-prerelease.0 (2024-12-20), но не стабильный. Открытые issues с уязвимостями в зависимостях (ReDoS), проблемы с merged cells при streaming.

**Как используется в проекте:** Только **чтение** XLSX → JSON (перебор sheets, rows, cells → объект с буквенными колонками A, B, C...). Не используются: запись, стили, формулы, форматирование.

#### Кандидаты на замену

| Библиотека | Версия | Обновлён | Downloads/нед | CJS | Задача "чтение XLSX → JSON" |
|------------|--------|----------|---------------|-----|----------------------------|
| **`read-excel-file`** | 6.0.3 | 2026-01-29 | ~260K | ✅ | **Идеально подходит.** Заточен на чтение → JSON. Встроенные типы TS. Активно поддерживается. Лёгкий (нет тяжёлых зависимостей) |
| `xlsx` (SheetJS) | 0.18.5 | 2024-10-22 | ~6M | ✅ | Мощный, но тяжёлый. Лицензия спорная (Apache-2.0 с ограничениями). Последний релиз 1.5 года назад |
| `node-xlsx` | 0.24.0 | — | ~640K | ✅ | Обёртка над SheetJS. Наследует его проблемы |
| `xlsx-stream-reader` | 1.1.1 | 2022-06-29 | — | ✅ | Streaming, но 3.5 года без обновлений. Мёртвый проект |
| `exceljs` | 4.4.0 | 2023-10-19 | ~1.6M | ✅ | Текущий. Мейнтейнер в отпуске. Уязвимости |

#### Рекомендация: **`read-excel-file`**

**Почему:**
- Активно поддерживается (обновлён 2026-01-29)
- Встроенные TypeScript типы
- Заточен именно на чтение XLSX → JSON (наш use case)
- Лёгкий — нет тяжёлых зависимостей типа archiver/saxes
- Поддерживает schema-based parsing (бонус)
- CJS-совместим
- Для файлов до 100K строк — достаточная производительность (наш лимит — 50MB файлы)

**Ограничения:**
- Не поддерживает формулы (нам не нужны)
- Для >100K строк медленнее SheetJS (нам не критично — у нас конвертер документов, не ETL)
- Нет записи (нам не нужна)

**Миграция:** Простая — заменить `ExcelJS.Workbook` → `readXlsxFile` с маппингом колонок A, B, C...

---

### 1.6 Анализ оптимальности текущих подходов в коде

| Задача | Текущий подход | Оптимальнее? | Рекомендация |
|--------|---------------|-------------|--------------|
| **XLSX → JSON** | `exceljs` — полный Workbook API, используется 5% возможностей | ❌ Overkill | `read-excel-file` — легче, быстрее для read-only |
| **CSV → JSON** | `papaparse` с streaming для больших файлов | ✅ Оптимально | Оставить. PapaParse — стандарт для CSV |
| **DOCX → text** | `officeparser` → `mammoth` → `JSZip` (3 fallback) | ❌ Избыточно | 2 fallback достаточно: `officeparser` → `mammoth`. JSZip-fallback удалить |
| **DOCX → HTML** | `mammoth.convertToHtml()` | ✅ Оптимально | Оставить. Mammoth — лучший для DOCX→HTML |
| **PDF → text** | `officeparser` | ✅ Оптимально | Оставить |
| **XML → JSON** | `fast-xml-parser` | ✅ Оптимально | Обновить до v5. Самый быстрый XML парсер для Node.js |
| **HTML → text** | `node-html-parser` → `.text` → `sanitize-html` | ❌ Дубль | Убрать `sanitize-html`, использовать `.textContent` |
| **Encoding detect** | `jschardet.detect()` + `iconv.decode()` | ❌ Устаревший | `chardet.detect()` + `Buffer.toString(encoding)` или `iconv-lite` 0.7 если нужны экзотические кодировки |
| **File type detect** | `file-type` v16 (CJS) | ⚠️ Вынужденно | v16 — последняя CJS. v17+ ESM-only. Оставить |
| **Concurrency** | Кастомный `promisePool()` с багом | ❌ Баг | Исправить (Set вместо Array) или использовать `Promise.allSettled` с chunking |
| **PPT/DOC** | Проверка CFB signature + officeparser | ✅ OK | Объединить дублирующийся код doc/ppt |
| **ODT/ODP/ODS** | 3 идентичных блока через officeparser | ❌ Дубль | Одна функция с параметром формата |

---

## 2. КОД — ПРОБЛЕМЫ

### 2.1 Дублирование кода

| Место | Проблема |
|-------|----------|
| `_getFirst()` (строка 240) и `getVal()` (строка 245) | **Полный дубль.** `_getFirst` не используется нигде |
| `strategies.xlsx` (строка 563-584) и `processExcel()` (строка 671-698) | **Дубль.** `processExcel()` содержит тот же xlsx-код, но вызывается только для CSV (где сразу уходит в `streamCsvStrategy`). xlsx-ветка в `processExcel` — мёртвый код |
| `strategies.csv` → `processExcel()` → `streamCsvStrategy()` | **Избыточная цепочка.** CSV всегда идёт через `streamCsvStrategy`. `processExcel` — прослойка-рудимент |
| `strategies.odt`, `strategies.odp`, `strategies.ods` | **Три идентичных блока** — отличаются только строкой ошибки |
| `strategies.doc` и `strategies.ppt` | **Почти идентичны** — CFB signature check + fallback |

### 2.2 Мёртвый код

| Место | Проблема |
|-------|----------|
| `_getFirst()` (строка 240-242) | Не используется. Дубль `getVal()` |
| `processExcel()` (строка 671-698) | xlsx-ветка мёртвая. Функция — обёртка над `streamCsvStrategy` |
| `promisePool()` | Баг: `executing.splice(executing.indexOf(p), 1)` — indexOf может вернуть -1 |
| `standalone/` директория | Полностью сломана: ссылается на `chardet`, `cheerio`, `pdf-parse`, `xml2js` — которых нет в dependencies |
| `create-standalone.js` | Генерирует `undefined` в standalone/package.json |

### 2.3 Архитектурные проблемы

| Проблема | Описание |
|----------|----------|
| **God File** | `FileToJsonNode.node.ts` — 930 строк. Всё в одном файле |
| **Нет `files` в package.json** | Без whitelist npm публикует всё, что не в .npmignore |
| **Нет `usableAsTool`** | n8n 2.x поддерживает `usableAsTool: true` для AI Agent |
| **tsconfig.json — 116 строк мусора** | 90% — закомментированные дефолты от `tsc --init` |

---

## 3. STANDALONE — УДАЛИТЬ ПОЛНОСТЬЮ

| Проблема | Описание |
|----------|----------|
| **Рассинхрон зависимостей** | `standalone/package.json` содержит `chardet`, `cheerio`, `pdf-parse`, `xml2js` — которых нет в основном проекте |
| **`create-standalone.js` сломан** | Ссылается на несуществующие зависимости → генерирует `undefined` |
| **Версия** | `1.0.8` vs основной `1.1.2` |
| **`file-type: ^21.0.0`** | ESM-only, несовместим с CommonJS |

**Решение:** Удалить `standalone/`, `create-standalone.js`, скрипт `standalone` из package.json.

---

## 4. СОВМЕСТИМОСТЬ С n8n 2.7.0

| Аспект | Статус | Действие |
|--------|--------|----------|
| `INodeType` interface | ✅ Совместим | — |
| `IExecuteFunctions` | ✅ Совместим | — |
| `NodeConnectionTypes.Main` | ✅ Совместим | — |
| `n8nNodesApiVersion: 1` | ✅ Актуален | — |
| `n8n-workflow` version | ⚠️ `^1.82.0` устарел | Обновить до `^1.120.8` |
| `usableAsTool` | ❌ Отсутствует | Добавить для AI Agent |
| `this.logger` | ✅ Обработано через `?.` | — |
| `this.helpers.getBinaryDataBuffer` | ✅ Стабильный API | — |
| Возврат `INodeExecutionData[][]` | ✅ Корректный | — |

---

## 5. ПЛАН РЕФАКТОРИНГА (по приоритету)

### Фаза 1: Очистка зависимостей (CRITICAL)

1. **Удалить рудиментные devDependencies (11 пакетов):**
   - `@babel/core`, `@babel/preset-env`, `babel-loader`
   - `buffer`, `path-browserify`, `stream-browserify`, `util`
   - `@types/iconv-lite`, `@types/jszip`, `@types/sanitize-html`
   - `audit-ci`
   - `webpack`, `webpack-cli`

2. **Удалить рудиментные dependencies (4 пакета):**
   - `sanitize-html` → использовать `.textContent` из `node-html-parser`
   - `jszip` → убрать 3-й fallback DOCX
   - `jschardet` + `iconv-lite` → заменить на `chardet` ^2.1.1

3. **Заменить `exceljs` → `read-excel-file` ^6.0.3**

4. **Обновить пакеты:**
   - `mammoth`: ^1.9.1 → ^1.11.0
   - `officeparser`: ^5.1.1 → ^6.0.4 (major — проверить breaking changes)
   - `fast-xml-parser`: ^4.3.4 → ^5.3.4 (major — проверить breaking changes)
   - `node-html-parser`: ^6.1.12 → ^7.0.2 (major — проверить breaking changes)
   - `n8n-workflow` (dev): ^1.82.0 → ^1.120.8
   - `@types/papaparse` (dev): ^5.3.16 → ^5.5.2

5. **Удалить файлы и директории:**
   - `webpack.config.js`
   - `create-standalone.js`
   - `standalone/` (вся директория)

### Фаза 2: Рефакторинг кода (HIGH)

6. **Декомпозиция `FileToJsonNode.node.ts` (930 → ~200 строк):**
   - `src/strategies/` — стратегии по форматам
   - `src/processors/yml.ts` — YML процессор
   - `src/processors/html.ts` — HTML процессор
   - `src/utils/` — утилиты (sanitizeFileName, numberToColumn, promisePool)
   - `src/types.ts` — все интерфейсы
   - `src/FileToJsonNode.node.ts` — только класс ноды

7. **Удалить дубли:**
   - `_getFirst()` — удалить (не используется)
   - `processExcel()` — удалить (мёртвый код)
   - Объединить odt/odp/ods в одну функцию
   - Объединить doc/ppt CFB-проверку
   - CSV: напрямую через `streamCsvStrategy`, без прослойки

8. **Исправить `promisePool`:**
   - Заменить `executing.splice(executing.indexOf(p))` на `Set`

### Фаза 3: Модернизация (MEDIUM)

9. **tsconfig.json** — очистить от 100 строк комментариев
10. **package.json:**
    - Добавить `"files": ["dist"]`
    - Удалить скрипты: `bundle`, `bundle:watch`, `standalone`
    - Удалить `overrides.form-data` (проверить актуальность)
11. **Добавить `usableAsTool: true`** в description ноды
12. **Обновить .npmignore** — убрать ссылки на несуществующие файлы

### Фаза 4: Тесты и CI (LOW)

13. **Обновить тесты** под новую структуру и новые библиотеки
14. **Добавить `npm audit`** в CI pipeline

---

## 6. ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

| Метрика | До | После |
|---------|-----|-------|
| dependencies | 11 пакетов | 7 пакетов (-36%) |
| devDependencies | 20 пакетов | 10 пакетов (-50%) |
| Устаревшие пакеты (>1 года) | 4 (exceljs, jschardet, file-type, mammoth) | 1 (file-type — вынужденно) |
| FileToJsonNode.node.ts | 930 строк | ~200 строк |
| Файлы в src/ | 5 | ~10 (каждый < 150 строк) |
| n8n совместимость | 1.x | 2.7.0 |
| Мёртвый код | _getFirst, processExcel, standalone/ | 0 |
| Дубли | 5 мест | 0 |
