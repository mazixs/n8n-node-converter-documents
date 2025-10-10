# Проблемы обработки ошибок в FileToJsonNode

**Дата:** 2025-10-10  
**Файл:** `src/FileToJsonNode.node.ts`  
**Статус:** ✅ Исправлено

**Результаты:**
- ✅ Все тесты проходят (60/60)
- ✅ Линтер без ошибок
- ✅ TypeScript компилируется успешно
- ✅ Все найденные проблемы устранены

---

## Найденные проблемы

### 1. Двойное оборачивание ошибок (критично)
**Локация:** Строки 765-767  
**Описание:** Все ошибки из стратегий обработки оборачиваются в `ProcessingError`, даже специализированные типы (`UnsupportedFormatError`, `EmptyFileError`).

**Код:**
```typescript
} catch (e) {
  throw new ProcessingError(`${ext.toUpperCase()} processing error: ${(e as Error).message}`);
}
```

**Проблема:**
- Теряется тип оригинальной ошибки
- Дублируется текст сообщения
- Невозможно отловить конкретный тип ошибки выше

**Исправление:**
```typescript
} catch (e) {
  // Пробрасываем специализированные ошибки как есть
  if (e instanceof FileTypeError || 
      e instanceof FileTooLargeError ||
      e instanceof UnsupportedFormatError ||
      e instanceof EmptyFileError ||
      e instanceof ProcessingError) {
    throw e;
  }
  // Оборачиваем только неизвестные ошибки
  throw new ProcessingError(`${ext.toUpperCase()} processing error: ${(e as Error).message}`);
}
```

---

### 2. Бесполезная проверка UnsupportedFormatError
**Локация:** Строки 369-370 (DOC), 540-541 (PPT)  
**Описание:** Проверка `if (error instanceof UnsupportedFormatError) { throw error; }` не работает из-за проблемы №1.

**Решение:** Исправить проблему №1, тогда эта проверка заработает.

---

### 3. Антипаттерн в Excel (критично)
**Локация:** Строка 472  
**Описание:** Используется `throw new Error("Use ExcelJS for structured data")` для управления потоком выполнения.

**Код:**
```typescript
xls: async (buf, ext) => {
  try {
    const _text = await extractViaOfficeParser(buf);
    throw new Error("Use ExcelJS for structured data"); // ← ПЛОХО
  } catch {
    // Используем ExcelJS
  }
}
```

**Исправление:**
```typescript
xls: async (buf, ext) => {
  // Сразу используем ExcelJS для структурных данных
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf);
  
  const sheets: Record<string, unknown[]> = {};
  workbook.eachSheet((worksheet, _sheetId) => {
    const rows: unknown[] = [];
    worksheet.eachRow((row, _rowNumber) => {
      rows.push(row.values);
    });
    sheets[worksheet.name] = limitExcelSheet(rows);
  });
  
  return {
    text: JSON.stringify(sheets, null, 2),
    data: sheets,
    warning: Object.keys(sheets).length > 10 
      ? `Large workbook: ${Object.keys(sheets).length} sheets` 
      : undefined
  };
}
```

---

### 4. Потеря информации в PDF fallback
**Локация:** Строка 514  
**Описание:** При fallback на `pdf-parse` не показывается ошибка второго парсера.

**Код:**
```typescript
} catch {
  throw new ProcessingError(`PDF processing error: ${error instanceof Error ? error.message : String(error)}`);
}
```

**Исправление:**
```typescript
} catch (fallbackError) {
  throw new ProcessingError(
    `PDF processing error: Primary parser failed (${error instanceof Error ? error.message : String(error)}), ` +
    `Fallback parser failed (${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)})`
  );
}
```

---

### 5. Неконсистентность проверок типов
**Локация:** Все стратегии  
**Описание:** Только DOC/PPT проверяют `instanceof UnsupportedFormatError`, остальные форматы не проверяют.

**Решение:** После исправления проблемы №1, добавить проверки во все стратегии, где это необходимо:

```typescript
// Пример для ODT/ODP/ODS
odt: async (buf) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    // Пробрасываем специализированные ошибки
    if (error instanceof UnsupportedFormatError || error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(`ODT processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

---

## Приоритеты исправления

1. **Критично (P0):** Проблема №1 (двойное оборачивание) и №3 (антипаттерн Excel)
2. **Важно (P1):** Проблема №4 (потеря информации PDF fallback)
3. **Желательно (P2):** Проблема №5 (консистентность)

---

## Влияние на пользователей

- **Сейчас:** Неинформативные сообщения об ошибках, дублирование текста
- **После исправления:** Четкие, специализированные ошибки с полным контекстом

---

## Тесты для регрессии

После исправления необходимо добавить тесты:

```typescript
describe('Error handling', () => {
  it('should preserve UnsupportedFormatError type', async () => {
    // Тест на сохранение типа ошибки
  });
  
  it('should not double-wrap error messages', async () => {
    // Тест на отсутствие дублирования
  });
  
  it('should report both parser failures in fallback', async () => {
    // Тест на полноту информации
  });
});
```

---

## Реализованные исправления

### ✅ 1. Исправлено двойное оборачивание (строки 772-783)
**Изменения:**
```typescript
} catch (e) {
  // Пробрасываем специализированные ошибки как есть
  if (e instanceof FileTypeError || 
      e instanceof FileTooLargeError ||
      e instanceof UnsupportedFormatError ||
      e instanceof EmptyFileError ||
      e instanceof ProcessingError) {
    throw e;
  }
  // Оборачиваем только неизвестные ошибки
  throw new ProcessingError(`${ext.toUpperCase()} processing error: ${(e as Error).message}`);
}
```

**Результат:** Специализированные ошибки теперь пробрасываются без изменений, сохраняя тип и оригинальное сообщение.

---

### ✅ 2. Убран антипаттерн в Excel (строки 478-499)
**Было:**
```typescript
try {
  const _text = await extractViaOfficeParser(buf);
  throw new Error("Use ExcelJS for structured data"); // ← throw для управления потоком
} catch {
  // ExcelJS код
}
```

**Стало:**
```typescript
// Используем ExcelJS напрямую для полной поддержки структуры Excel
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buf as any);
// ... остальной код
```

**Результат:** Устранен анти-паттерн "исключения для управления потоком", код стал чище и быстрее.

---

### ✅ 3. Исправлен PDF fallback (строки 508-524)
**Было:**
```typescript
} catch {
  throw new ProcessingError(`PDF processing error: ${error...}`);
}
```

**Стало:**
```typescript
} catch (fallbackError) {
  throw new ProcessingError(
    `PDF processing error: Primary parser failed (${error...}), ` +
    `Fallback parser failed (${fallbackError...})`
  );
}
```

**Результат:** Теперь пользователь видит информацию об обеих попытках парсинга.

---

### ✅ 4. Добавлена консистентность в ODT/ODP/ODS (строки 444-476)
**Добавлено в каждую стратегию:**
```typescript
} catch (error) {
  // Пробрасываем специализированные ошибки как есть
  if (error instanceof UnsupportedFormatError || error instanceof ProcessingError) {
    throw error;
  }
  throw new ProcessingError(`ODT processing error: ${error...}`);
}
```

**Результат:** Единообразная обработка ошибок во всех стратегиях.

---

### ✅ Бонус: Исправлен импорт NodeConnectionTypes (строки 38, 654-655)
**Было:**
```typescript
import { NodeConnectionType } from 'n8n-workflow';
inputs: [NodeConnectionType.Main], // ← Ошибка: тип используется как значение
```

**Стало:**
```typescript
import { NodeConnectionTypes } from 'n8n-workflow';
inputs: [NodeConnectionTypes.Main], // ← Корректно
```

**Результат:** Устранена ошибка TypeScript линтера.

---

## Преимущества после исправления

### Для пользователей:
- 🎯 **Точные сообщения:** Больше нет дублирования типа "DOCX processing error: DOCX processing error..."
- 🔍 **Полная информация:** Fallback показывает обе ошибки, не скрывая контекст
- 📝 **Корректные типы:** Можно отлавливать конкретные типы ошибок (`UnsupportedFormatError`, `EmptyFileError`)

### Для разработчиков:
- 🧹 **Чистый код:** Убран антипаттерн с throw для управления потоком
- 🔄 **Консистентность:** Единообразная обработка во всех стратегиях
- ⚡ **Производительность:** Excel обрабатывается напрямую без лишних try-catch
- ✅ **Типобезопасность:** Исправлены ошибки TypeScript линтера

---

## Тестирование

**Все существующие тесты проходят:**
```
Test Suites: 7 passed, 7 total
Tests:       60 passed, 60 total
Time:        3.46 s
```

**Проверки качества:**
- ✅ `npm run lint` — без ошибок (1 warning не связано с исправлениями)
- ✅ `npm run build` — успешная компиляция TypeScript
- ✅ `npm test` — 60/60 тестов проходят
