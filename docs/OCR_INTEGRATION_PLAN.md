# План интеграции OCR

## Оценка сложности: 7/10

### Этап 1: Базовая интеграция (2-3 дня)

#### Зависимости
```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0"  // +2.5 MB к пакету
  }
}
```

#### Код (псевдокод)
```typescript
import { createWorker } from 'tesseract.js';

async function extractTextViaOCR(imageBuffer: Buffer, language = 'eng'): Promise<string> {
  const worker = await createWorker(language);
  
  try {
    const { data: { text } } = await worker.recognize(imageBuffer);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

// В DOCX стратегии
if (enableOCR && documentHasImages) {
  const images = await extractImagesFromDocx(buf);
  const ocrTexts = await Promise.all(
    images.map(img => extractTextViaOCR(img))
  );
  extractedText += '\n\n[OCR]\n' + ocrTexts.join('\n');
}
```

---

## Реализация по форматам

### 1. **DOCX** (Сложность: средняя)
```typescript
// Извлечь изображения из word/media/*
const images = await extractImagesFromZip(docxZip);
// OCR для каждого изображения
const ocrText = await processImages(images);
```

**Проблемы:**
- Нужно извлекать изображения из ZIP
- Сопоставлять порядок изображений с текстом
- Обработка embedded изображений

### 2. **PDF** (Сложность: низкая)
```typescript
// pdf-parse уже извлекает изображения
const pdfData = await pdfParse(buf);
if (pdfData.text.length === 0 && pdfData.numPages > 0) {
  // PDF-изображение, нужен OCR
  const ocrText = await ocrPdf(buf);
}
```

**Проблемы:**
- PDF может быть сканом (весь документ = изображение)
- Нужна библиотека для рендеринга страниц PDF в изображения
- Требует `pdf-poppler` или `pdf-lib`

### 3. **Изображения напрямую** (Сложность: низкая)
```typescript
// Новый формат: JPG, PNG, TIFF
strategies.image = async (buf) => {
  const text = await extractTextViaOCR(buf);
  return { text };
};
```

**Проблемы:**
- Нужно добавить форматы: jpg, png, tiff в supported
- Простая реализация

### 4. **XLSX, PPTX** (Сложность: высокая)
- Изображения в слайдах/ячейках
- Сложная структура
- Редко содержит текст только в изображениях

---

## Производительность

### Бенчмарки (tesseract.js)

| Размер изображения | Время OCR | Качество |
|-------------------|-----------|----------|
| 800x600 (простой текст) | 2-4 сек | 85-95% |
| 1920x1080 (документ) | 5-10 сек | 70-85% |
| 3000x2000 (скан) | 10-20 сек | 60-80% |

**Проблема:** Документ с 10 изображениями = 20-100 секунд!

### Оптимизации:
1. **Promise pooling** (уже есть) — ограничить параллельность
2. **Resize изображений** — уменьшить до 1920px max
3. **Кэширование** — не обрабатывать повторно
4. **Worker threads** — не блокировать main thread

---

## Размер пакета

### Текущий размер
```
@mazix/n8n-nodes-converter-documents: ~20 KB (dist)
```

### С tesseract.js
```
tesseract.js: ~500 KB (код)
eng.traineddata: ~2.5 MB (языковая модель английского)
rus.traineddata: +3.8 MB (если нужен русский)
```

**Итого:** +3-6 MB к размеру пакета!

### Решения:
1. **Lazy loading** — загружать только при включении OCR
2. **External dependency** — пользователь устанавливает отдельно
3. **CDN** — загружать языковые модели с CDN

---

## Рекомендуемая архитектура

### Вариант 1: Опциональный плагин (лучший)

```typescript
// Основной пакет БЕЗ OCR
@mazix/n8n-nodes-converter-documents

// Дополнительный пакет С OCR
@mazix/n8n-nodes-converter-documents-ocr (опционально)
```

**Плюсы:**
- Основной пакет остается легким
- OCR только для тех, кому нужно
- Простое обновление

**Минусы:**
- Сложнее в установке
- Нужна документация

---

### Вариант 2: Встроенный с опцией (проще)

```typescript
{
  displayName: "OCR Settings",
  name: "ocrSettings",
  type: "collection",
  default: {},
  options: [
    {
      displayName: "Enable OCR",
      name: "enabled",
      type: "boolean",
      default: false
    },
    {
      displayName: "OCR Language",
      name: "language",
      type: "options",
      options: [
        { name: "English", value: "eng" },
        { name: "Russian", value: "rus" },
        { name: "German", value: "deu" }
      ],
      default: "eng"
    },
    {
      displayName: "Max Image Size (px)",
      name: "maxImageSize",
      type: "number",
      default: 1920,
      description: "Resize images larger than this (optimization)"
    }
  ]
}
```

---

## Оценка работы

### Усилия (человеко-дни)

| Задача | Сложность | Время |
|--------|-----------|-------|
| Интеграция tesseract.js | Средняя | 1 день |
| Извлечение изображений из DOCX | Средняя | 1 день |
| Обработка PDF с OCR | Средняя | 1 день |
| Оптимизация (resize, pooling) | Средняя | 1 день |
| Тестирование | Высокая | 2 дня |
| Документация | Низкая | 0.5 дня |
| **ИТОГО** | | **6.5 дней** |

### Риски

1. ⚠️ **Производительность** — OCR медленный, может быть timeout в n8n
2. ⚠️ **Качество** — tesseract.js хуже чем Tesseract C++ или cloud API
3. ⚠️ **Размер пакета** — +3-6 MB может быть проблемой
4. ⚠️ **Совместимость** — проблемы с Canvas в некоторых средах
5. ⚠️ **Поддержка** — вопросы пользователей "почему OCR плохой?"

---

## Альтернативные решения

### 1. **Рекомендация использовать внешние ноды**

В n8n уже есть OCR ноды:
- `n8n-nodes-tesseract`
- `n8n-nodes-google-vision`

**Workflow:**
```
[Read File] → [Converter Documents] → [If empty text] → [Tesseract OCR]
```

**Плюсы:**
- ✅ Модульность
- ✅ Пользователь выбирает OCR провайдера
- ✅ Не увеличивает размер нашего пакета

---

### 2. **Интеграция как beta feature**

```typescript
if (process.env.ENABLE_EXPERIMENTAL_OCR === 'true') {
  // OCR логика
}
```

**Плюсы:**
- Можно тестировать с early adopters
- Легко откатить при проблемах

---

## Финальная рекомендация

### ❌ **НЕ рекомендую встраивать OCR в текущий пакет**

**Причины:**
1. **+200% размера пакета** (20KB → 70KB + 3MB данных)
2. **10-100x медленнее** (2-100 сек vs 0.5-2 сек)
3. **Редкий use case** (<5% пользователей нужен OCR)
4. **Низкое качество** tesseract.js vs cloud API
5. **Сложная поддержка** — много граничных случаев

### ✅ **Рекомендую:**

**Вариант A: Документировать workflow с внешними OCR нодами**
```markdown
## Working with scanned documents

For documents containing images with text (scans), use this workflow:

1. Extract text with `@mazix/n8n-nodes-converter-documents`
2. If empty → extract images
3. Process images with `Google Vision API` or `Tesseract` node
4. Combine results
```

**Вариант B: Отдельный пакет (если очень нужно)**
```
@mazix/n8n-nodes-converter-documents-ocr
```
- Включает все из основного пакета
- Добавляет OCR функциональность
- Пользователь выбирает что устанавливать

---

## Выводы

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| Техническая сложность | 7/10 | Реализуемо, но много нюансов |
| Время разработки | 6-7 дней | Полная интеграция с тестами |
| Риски | Высокие | Производительность, размер, качество |
| Польза vs стоимость | Низкая | Мало кому нужно, дорого поддерживать |
| **Рекомендация** | **НЕТ** | Лучше документировать интеграцию с внешними нодами |

---

## Если всё-таки нужен OCR

### Минимальная реализация (proof of concept)

```typescript
// 1. Добавить зависимость (опционально)
npm install tesseract.js --save-optional

// 2. Lazy import
async function tryOCR(imageBuffer: Buffer) {
  try {
    const tesseract = await import('tesseract.js');
    const worker = await tesseract.createWorker('eng');
    const { data } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return data.text;
  } catch {
    throw new Error('OCR not available. Install with: npm install tesseract.js');
  }
}

// 3. Использовать только при явном запросе
if (this.getNodeParameter('enableOCR', 0, false)) {
  ocrText = await tryOCR(imageBuffer);
}
```

**Время реализации:** 2-3 дня (минимальная версия)
**Размер:** +500KB код + пользователь качает модели отдельно
