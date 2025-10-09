# 🔧 Исправление ошибки "File is empty or contains no text"

## Что было исправлено в версии 1.0.12

### 1. Улучшенная диагностика DOCX парсеров

**Было:**
```typescript
docx: async (buf) => {
  try {
    return { text: await extractViaOfficeParser(buf) };
  } catch (error) {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      return { text: result.value };
    } catch {
      throw new ProcessingError(`DOCX processing error: ${error.message}`);
    }
  }
}
```

**Стало:**
```typescript
docx: async (buf) => {
  try {
    const text = await extractViaOfficeParser(buf);
    return { text: text || '' };
  } catch (error) {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      return { text: result.value || '' };
    } catch (fallbackError) {
      throw new ProcessingError(
        `DOCX processing error: Primary parser failed (${error.message}), ` +
        `Fallback parser failed (${fallbackError.message})`
      );
    }
  }
}
```

**Что улучшено:**
- ✅ Явная обработка пустых строк от парсеров
- ✅ Детальная информация об ошибках обоих парсеров
- ✅ Лучшая диагностика проблем

---

### 2. Информативное сообщение об ошибке

**Было:**
```
EmptyFileError: File is empty or contains no text
```

**Стало:**
```
EmptyFileError: File "file_156.docx" (DOCX, 916.02 KB) contains no extractable text.
Possible reasons:
  (1) File contains only images/graphics without text
  (2) File is password-protected or encrypted
  (3) File structure is corrupted
  (4) File was created with a non-standard application
Try: Open file in original application and verify it contains text, then save it again.
```

**Что улучшено:**
- ✅ Показывается имя и размер файла
- ✅ Перечислены возможные причины
- ✅ Даны рекомендации по решению проблемы
- ✅ Пользователь понимает, что делать дальше

---

## Обновление ноды в n8n

### Вариант 1: Через npm (рекомендуется)

```bash
# Остановите n8n
# ...

# Обновите пакет
npm update @mazix/n8n-nodes-converter-documents

# Запустите n8n
# ...
```

Или через веб-интерфейс n8n:
1. Settings → Community Nodes
2. Найдите `@mazix/n8n-nodes-converter-documents`
3. Нажмите Update

---

### Вариант 2: Ручное обновление (для custom nodes)

```bash
# Перейдите в папку ноды
cd ~/.n8n/custom-nodes/n8n-node-converter-documents

# Сделайте backup
cp -r . ../n8n-node-converter-documents.backup

# Скопируйте новые файлы из репозитория
cd ~/path/to/n8n-node-converter-documents
npm run build

# Скопируйте скомпилированные файлы
cp dist/* ~/.n8n/custom-nodes/n8n-node-converter-documents/

# Перезапустите n8n
```

---

### Вариант 3: Standalone пересборка

```bash
# Клонируйте/обновите репозиторий
cd ~/n8n-node-converter-documents
git pull

# Пересоберите standalone версию
npm install
npm run standalone

# Замените текущую установку
rm -rf ~/.n8n/custom-nodes/n8n-node-converter-documents
cp -r ./standalone ~/.n8n/custom-nodes/n8n-node-converter-documents

# Установите зависимости
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
npm install --production

# Перезапустите n8n
```

---

## Тестирование исправления

### Тест 1: Нормальный DOCX файл

```bash
# Должен обработаться успешно
# Input: file.docx с текстом
# Expected: { text: "...", metadata: {...} }
```

### Тест 2: DOCX только с картинками

```bash
# Должен выдать информативную ошибку
# Input: file.docx только с изображениями
# Expected: EmptyFileError с подробным описанием
```

### Тест 3: Поврежденный DOCX

```bash
# Должен выдать ProcessingError с деталями
# Input: поврежденный file.docx
# Expected: ProcessingError с информацией о том, какой парсер и как упал
```

### Тест 4: Защищенный паролем DOCX

```bash
# Должен выдать EmptyFileError с рекомендациями
# Input: зашифрованный file.docx
# Expected: EmptyFileError с советом снять защиту
```

---

## Проверка версии ноды

После обновления проверьте версию:

```bash
# В n8n workflow
# Добавьте node "Convert File to JSON"
# Наведите на ноду - должна показаться версия
```

Или программно:

```bash
cd ~/.n8n/custom-nodes/n8n-node-converter-documents
cat package.json | grep version
```

Должно быть: `"version": "1.0.12"` или выше.

---

## Changelog v1.0.12

### 🐛 Bug Fixes
- **Диагностика:** Улучшено сообщение об ошибке EmptyFileError с детализацией
- **DOCX parser:** Добавлена информация об ошибках обоих парсеров (officeparser + mammoth)
- **Явная обработка:** Пустые строки от парсеров теперь обрабатываются явно

### 📚 Documentation
- **TROUBLESHOOTING_EMPTY_FILE.md:** Полное руководство по диагностике проблем с пустыми файлами
- **FIX_EMPTY_FILE_ERROR.md:** Инструкция по обновлению ноды

### ⚡ Improvements
- **User Experience:** Пользователи теперь получают понятные сообщения об ошибках с рекомендациями
- **Debugging:** Разработчики могут легче диагностировать проблемы парсинга

---

## Известные проблемы (не баги)

### Файлы с только изображениями

**Проблема:**
- DOCX файл содержит только картинки/фотографии
- Текстовые парсеры не могут извлечь текст

**Не является багом потому что:**
- Парсеры работают корректно
- Текста действительно нет в документе
- OCR не входит в scope ноды (это отдельная функциональность)

**Решение:**
- Используйте OCR инструменты (см. `docs/ocr_example.md`)
- Или добавьте текстовое содержимое в документ

---

### Защищенные паролем файлы

**Проблема:**
- Файл зашифрован или защищен паролем
- Парсеры не могут прочитать содержимое

**Не является багом потому что:**
- Защита работает как задумано
- Без пароля невозможно расшифровать

**Решение:**
- Снимите защиту в Word/LibreOffice
- Сохраните незащищенную версию
- Обработайте новый файл

---

## Дополнительная помощь

### Если проблема не решается

1. **Прочитайте:** `docs/TROUBLESHOOTING_EMPTY_FILE.md`
2. **Попробуйте:** Альтернативные методы из документа
3. **Создайте Issue:** https://github.com/mazixs/n8n-node-converter-documents/issues

### При создании Issue приложите:

```bash
# Информация о файле
file file_156.docx
exiftool file_156.docx

# Информация о системе
node --version
npm list @mazix/n8n-nodes-converter-documents

# Попытка ручного парсинга
unzip -l file_156.docx
```

---

**Версия документа:** 1.0
**Дата:** 2025-10-09
**Применимо к версии ноды:** 1.0.12+
