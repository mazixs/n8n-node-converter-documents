# Анализ mammoth.js и рекомендации по Markdown конвертации

## 🔍 Исследование официальной документации

### Источники:
1. **Официальный README**: https://github.com/mwilliamson/mammoth.js
2. **npm документация**: https://www.npmjs.com/package/mammoth
3. **GitHub Issue #273**: Проблема с таблицами в Markdown
4. **turndown документация**: https://www.npmjs.com/package/turndown

---

## ❌ Критическая находка: `convertToMarkdown` DEPRECATED

### Цитата из официальной документации:

```
#### `mammoth.convertToMarkdown(input, options)`

Markdown support is deprecated.
Generating HTML and using a separate library to convert the HTML to Markdown is recommended,
and is likely to produce better results.
```

### Что это означает:

1. **Deprecated** — `mammoth.convertToMarkdown()` устарел и не поддерживается
2. **Автор сам рекомендует** использовать другой подход:
   - Генерировать HTML через `mammoth.convertToHtml()`
   - Конвертировать HTML → Markdown отдельной библиотекой
3. **Лучшие результаты** — такой подход даст более качественный Markdown

---

## 🐛 Проблема с таблицами (подтверждено)

### GitHub Issue #273:
**Проблема:** "docx to markdown, innerHTML to react-markdown-editor-lite. tables not working."

**Описание:**
- Таблицы конвертируются в `<p>` теги вместо Markdown синтаксиса
- Нет символов `|` для таблиц
- Структура таблиц теряется

**Наши тесты подтверждают:**
```
✗ Таблицы в Markdown формате: false
✗ Символы таблиц найдены: false (0 символов |)
✓ HTML содержит <table>: true (3 таблицы)
```

---

## 🎯 Правильный подход (рекомендация автора mammoth)

### Схема работы:

```
DOCX → mammoth.convertToHtml() → HTML → turndown → Markdown
```

### Почему это работает:

1. **mammoth.convertToHtml()** — полностью поддерживается, стабильно работает
   - ✅ Таблицы как `<table>`
   - ✅ Заголовки как `<h1>`, `<h2>`
   - ✅ Форматирование как `<strong>`, `<em>`
   - ✅ Списки как `<ul>`, `<ol>`

2. **turndown** — специализированная библиотека HTML → Markdown
   - ✅ 7.2.1 версия (актуальная, 1 месяц назад)
   - ✅ 983 зависимых пакета
   - ✅ Активная поддержка

3. **turndown-plugin-gfm** — GitHub Flavored Markdown расширения
   - ✅ Поддержка таблиц
   - ✅ Strikethrough
   - ✅ Task lists

---

## 📊 Сравнение подходов

| Критерий | convertToMarkdown (deprecated) | convertToHtml + turndown |
|----------|-------------------------------|--------------------------|
| **Статус** | ❌ Deprecated | ✅ Рекомендовано автором |
| **Таблицы** | ❌ Не работают | ✅ Полная поддержка |
| **Поддержка** | ❌ Нет обновлений | ✅ Активная |
| **Качество** | ⚠️ Низкое | ✅ Высокое |
| **Настройка** | ⚠️ Ограничена | ✅ Гибкая |
| **Размер пакета** | 0 KB (уже есть) | +50 KB (turndown) |

---

## 💡 Наши проблемы в коде

### 1. Используем deprecated метод
```typescript
// ❌ НЕПРАВИЛЬНО (наш текущий код)
const result = await mammoth.convertToMarkdown({ buffer });
// Таблицы не работают, deprecated
```

### 2. Неверные ожидания от API
```typescript
// В тесте
const hasTableSyntax = result.value.includes('|');
expect(hasTableSyntax).toBe(true); // ❌ ВСЕГДА false
```

### 3. Отсутствие типов
```typescript
// Нужен workaround
interface MammothExtended {
  convertToMarkdown(...): Promise<...>;
}
// Типы @types/mammoth не включают convertToMarkdown
```

---

## ✅ Правильное решение

### Установка зависимостей:

```bash
npm install turndown turndown-plugin-gfm
```

### Размер:
- `turndown`: ~30 KB
- `turndown-plugin-gfm`: ~5 KB
- **Итого**: +35 KB (вместо использования deprecated API)

### Пример кода:

```typescript
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  // Шаг 1: DOCX → HTML (стабильный, поддерживаемый API)
  const htmlResult = await mammoth.convertToHtml({ buffer });
  
  // Шаг 2: HTML → Markdown с поддержкой таблиц
  const turndownService = new TurndownService({
    headingStyle: 'atx',      // # Heading вместо Heading\n=======
    codeBlockStyle: 'fenced', // ```code``` вместо отступов
    bulletListMarker: '-',    // - item вместо * item
  });
  
  // Добавляем GitHub Flavored Markdown (таблицы, strikethrough, task lists)
  turndownService.use(gfm);
  
  // Конвертация
  const markdown = turndownService.turndown(htmlResult.value);
  
  return markdown;
}
```

---

## 🧪 Ожидаемые результаты

### С текущим подходом (deprecated):
```markdown
Ситуация

Что делать

Часто ищешь по одному полю

Создай индекс
```

### С правильным подходом (HTML → Markdown):
```markdown
| Ситуация | Что делать |
| --- | --- |
| Часто ищешь по одному полю | Создай индекс |
| Часто ищешь по нескольким | Создай составной индекс |
```

---

## 📋 План миграции

### Этап 1: Установка зависимостей (5 мин)
```bash
npm install turndown turndown-plugin-gfm
npm install --save-dev @types/turndown
```

### Этап 2: Создание helper функции (30 мин)
```typescript
// src/helpers/markdownConverter.ts
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export function createMarkdownConverter(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    strongDelimiter: '**',
    emDelimiter: '*',
  });
  
  service.use(gfm);
  
  // Кастомные правила (опционально)
  service.addRule('removeExtraNewlines', {
    filter: () => true,
    replacement: (content) => content.replace(/\n{3,}/g, '\n\n'),
  });
  
  return service;
}

export function htmlToMarkdown(html: string): string {
  const converter = createMarkdownConverter();
  return converter.turndown(html);
}
```

### Этап 3: Обновление DOCX стратегии (1 час)
```typescript
// В FileToJsonNode.node.ts

strategies.docx = async (buf: Buffer) => {
  const outputFormat = this.getNodeParameter('outputFormat', 0, 'text') as string;
  
  if (outputFormat === 'markdown') {
    try {
      // Попытка 1: mammoth HTML → turndown Markdown
      const htmlResult = await mammoth.convertToHtml({ buffer: buf });
      
      if (htmlResult.value && htmlResult.value.length > 0) {
        const markdown = htmlToMarkdown(htmlResult.value);
        return { text: markdown, format: 'markdown' };
      }
    } catch (err) {
      // Fallback на наш XML парсер
      const parsed = await parseDocxToMarkdown(buf);
      return { text: parsed, format: 'markdown' };
    }
  }
  
  // Обычный текстовый режим (как сейчас)
  // ...
};
```

### Этап 4: Тестирование (1 час)
- Обновить существующие тесты
- Добавить тесты для таблиц
- Проверить на реальных документах

### Этап 5: Документация (30 мин)
- Обновить README
- Обновить CHANGELOG
- Примеры использования

**Общее время:** ~3 часа

---

## 🔄 Сравнение с текущей реализацией

### Что мы делали (неправильно):
```typescript
// ❌ Используем deprecated API
const result = await mammoth.convertToMarkdown({ buffer });

// ❌ Таблицы не работают
// ❌ Нет типов
// ❌ Автор не рекомендует
```

### Что нужно делать (правильно):
```typescript
// ✅ Используем поддерживаемый API
const htmlResult = await mammoth.convertToHtml({ buffer });

// ✅ Специализированная библиотека для Markdown
const markdown = turndownService.turndown(htmlResult.value);

// ✅ Таблицы работают
// ✅ Есть типы
// ✅ Рекомендовано автором
```

---

## 🎯 Преимущества правильного подхода

1. **Стабильность**
   - Используем поддерживаемые API
   - Нет deprecated предупреждений
   - Активная поддержка библиотек

2. **Функциональность**
   - ✅ Таблицы в Markdown формате
   - ✅ GitHub Flavored Markdown
   - ✅ Кастомные правила конвертации

3. **Качество**
   - Лучшее качество Markdown (подтверждено автором mammoth)
   - Полный контроль над форматированием
   - Гибкие настройки

4. **Поддержка**
   - turndown: 983 зависимых пакета
   - Активная разработка
   - Хорошая документация

5. **Типизация**
   - @types/turndown доступен
   - TypeScript friendly
   - Нет workaround с типами

---

## 📦 Воздействие на проект

### Размер пакета:
- **Текущий:** ~20 KB (dist)
- **С turndown:** ~55 KB (+35 KB)
- **Приемлемо:** Да, +175% но функциональность оправдывает

### Производительность:
- **mammoth.convertToHtml:** ~100-200ms (как сейчас)
- **turndown.turndown:** +10-50ms (быстрая DOM операция)
- **Итого:** ~110-250ms (незначительное замедление)

### Совместимость:
- ✅ Node.js: Полная поддержка
- ✅ Browser: Поддерживается (UMD bundle)
- ✅ TypeScript: Есть типы
- ✅ n8n: Совместимо

---

## 🚀 Рекомендация

### ✅ **ОДНОЗНАЧНО МИГРИРОВАТЬ**

**Причины:**
1. Текущий подход deprecated и не рекомендуется автором
2. Таблицы не работают (критичный баг)
3. Правильный подход прост и хорошо документирован
4. Минимальное влияние на размер/производительность
5. Улучшит качество Markdown вывода

**Время реализации:** ~3 часа
**Риски:** Минимальные
**Выгода:** Высокая

---

## 📝 Заключение

Наш текущий код использует **deprecated API** (`mammoth.convertToMarkdown`), который:
- ❌ Не поддерживает таблицы
- ❌ Не рекомендуется автором
- ❌ Дает низкое качество Markdown

**Правильный подход:**
1. `mammoth.convertToHtml()` — стабильный, поддерживаемый
2. `turndown` + `turndown-plugin-gfm` — специализированная конвертация HTML → Markdown
3. Результат: таблицы работают, качество высокое, код современный

**Следующий шаг:** Реализовать миграцию (3 часа работы, огромная польза)
