# План реализации DOCX → HTML конвертации

## ✅ Что уже сделано:

1. **Тесты написаны** (`test/integration/docx-to-html.test.ts`)
   - ✅ Проверка конвертации таблиц
   - ✅ Проверка простого текста
   - ✅ Проверка TextBox
   - ✅ Анализ качества HTML
   - ✅ Сравнение TEXT vs HTML

2. **Доказано что работает:**
   - `mammoth.convertToHtml()` конвертирует таблицы ✅
   - Все 3 таблицы из `onlyoffice2.docx` извлечены ✅
   - 18 строк, ~36 ячеек ✅
   - Структура сохранена полностью ✅

---

## 📋 Что осталось сделать:

### Этап 1: Добавить опцию outputFormat в parameters (15 мин)

```typescript
// В FileToJsonNode.node.ts, секция properties
{
  displayName: 'Output Format',
  name: 'outputFormat',
  type: 'options',
  options: [
    {
      name: 'Plain Text',
      value: 'text',
      description: 'Extract text only (fastest, smallest)',
    },
    {
      name: 'HTML',
      value: 'html',
      description: 'Convert to HTML (preserves tables, formatting)',
    },
  ],
  default: 'text',
  description: 'Choose output format for DOCX files',
  displayOptions: {
    show: {
      operation: ['fileToJson'],
    },
  },
}
```

### Этап 2: Обновить DOCX стратегию (30 мин)

```typescript
strategies.docx = async (buf: Buffer) => {
  const outputFormat = this.getNodeParameter('outputFormat', 0, 'text') as string;
  
  if (outputFormat === 'html') {
    try {
      // HTML конвертация
      const result = await mammoth.convertToHtml({ buffer: buf });
      
      if (result.value && result.value.length > 0) {
        return result.value;
      }
    } catch (err) {
      this.logger?.warn(`mammoth HTML conversion failed: ${err.message}, trying fallback`);
    }
  }
  
  // Fallback на текущую логику (text)
  try {
    const result = await officeParser.parseOfficeAsync(buf);
    if (result && result.length > 0) {
      return result;
    }
  } catch (err) {
    // XML fallback...
  }
};
```

### Этап 3: Обновить тесты FileToJsonNode (30 мин)

Добавить тесты для HTML режима:
```typescript
it('should convert DOCX to HTML with tables', async () => {
  const result = await node.execute.call(context, { 
    outputFormat: 'html' 
  });
  
  expect(result).toContain('<table>');
  expect(result).toContain('<tr>');
  expect(result).toContain('<td>');
});
```

### Этап 4: Документация (15 мин)

- Обновить README
- Обновить CHANGELOG
- Примеры использования

---

## 🎯 Итоговое время: ~1.5 часа

---

## 📊 Преимущества решения:

1. **Простота**
   - ✅ Никаких дополнительных зависимостей
   - ✅ Используем существующий mammoth
   - ✅ Один параметр, два режима

2. **Функциональность**
   - ✅ Таблицы работают идеально
   - ✅ Форматирование сохраняется
   - ✅ AI понимает HTML так же как Markdown

3. **Производительность**
   - ✅ HTML быстрее чем Markdown (нет дополнительной конвертации)
   - ✅ Меньше зависимостей = меньше bundle size

4. **Совместимость**
   - ✅ Обратная совместимость (text — default)
   - ✅ Опциональный выбор формата
   - ✅ Все существующие workflow продолжат работать

---

## 🚀 Следующий шаг:

Реализовать Этапы 1-4 (~1.5 часа)
