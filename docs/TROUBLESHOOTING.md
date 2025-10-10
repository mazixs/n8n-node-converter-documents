# 🔧 Troubleshooting: "File is empty or contains no text"

**Версия:** 1.0.12+  
**Дата обновления:** 2025-10-09

---

## 📋 Краткое описание проблемы

### Симптомы

Вы получаете ошибку при обработке файла:
```
EmptyFileError: File is empty or contains no text
```

**Но файл:**
- ✅ Успешно загружается
- ✅ Имеет нормальный размер (например, 938 KB)
- ✅ Формат распознан корректно (DOCX, PDF и т.д.)

### Причина

Файл обработан без ошибок, но извлеченный текст пустой или содержит только пробелы.

---

## ⚡ Быстрое решение (90% случаев)

### Метод "Пересохранение"

```
1. Откройте файл в Microsoft Word или LibreOffice Writer
2. Выделите весь контент: Ctrl+A
3. Скопируйте: Ctrl+C
4. Создайте новый документ: Ctrl+N
5. Вставьте: Ctrl+V
6. Сохраните как новый файл
7. Попробуйте обработать новый файл в n8n
```

**Это решит проблемы с:**
- Поврежденной структурой
- Нестандартными элементами
- Некоторыми видами защиты

---

## 🔍 Возможные причины

### 1. 📄 Файл содержит только изображения/графику

**Симптомы:**
- Документ визуально выглядит заполненным
- Но весь контент — это картинки, фотографии, диаграммы
- Нет текстовых элементов для извлечения

**Решение:**
- Добавьте текстовое содержимое в документ
- Или используйте OCR для извлечения текста из изображений
- См. `docs/ocr_example.md` для примеров OCR

---

### 2. 🔒 Файл защищен паролем или зашифрован

**Симптомы:**
- При открытии в Word требуется пароль
- Файл имеет защиту от редактирования
- Документ зашифрован

**Решение:**
```
1. Откройте файл в Word/LibreOffice с паролем
2. File → Info → Protect Document → Remove Protection
3. File → Save As → сохраните незащищенную версию
4. Обработайте новый файл в n8n
```

---

### 3. 💥 Поврежденная структура файла

**Симптомы:**
- Файл открывается с ошибками
- Word предлагает "восстановить" файл
- Размер файла необычно большой или маленький

**Решение:**
```
1. Откройте файл в Word
2. Согласитесь на восстановление (если предлагается)
3. File → Save As → выберите новое имя
4. Попробуйте обработать новый файл
```

**Альтернатива - онлайн восстановление:**
- https://www.officerecovery.com/word/
- https://onlinefilerepair.com/

---

### 4. 📐 Текст в нестандартных элементах

**Симптомы:**
- Визуально текст присутствует
- Но это WordArt, SmartArt, формы, надписи
- Парсеры не могут извлечь такой текст

**Решение:**
```
1. Откройте файл в Word
2. Выделите текст внутри объектов
3. Скопируйте в обычный текстовый формат
4. Создайте новый документ с обычным текстом
5. Сохраните и попробуйте снова
```

---

### 5. 🔧 Файл создан нестандартной программой

**Симптомы:**
- Файл создан не в MS Word или LibreOffice
- Экспортирован из PDF, Google Docs, Scrivener
- Внутренняя структура отличается

**Решение:**
```
1. Откройте в Microsoft Word 2016+ или LibreOffice
2. Скопируйте весь текст (Ctrl+A → Ctrl+C)
3. Создайте новый пустой документ
4. Вставьте текст (Ctrl+V)
5. Сохраните как новый DOCX файл
```

---

## 🛠️ Пошаговая диагностика

### Шаг 1: Проверка в оригинальном приложении

```bash
# Linux: Установите LibreOffice
sudo apt install libreoffice-writer

# Откройте файл
libreoffice --writer file.docx
```

**Проверьте:**
- [ ] Файл открывается без ошибок?
- [ ] Требуется ли пароль?
- [ ] Есть ли текстовое содержимое (не только картинки)?
- [ ] Можно ли выделить текст мышью?

---

### Шаг 2: Ручное извлечение (для DOCX)

```bash
# DOCX — это ZIP архив, распакуйте его
unzip -q file.docx -d file_extracted

# Посмотрите содержимое основного документа
cat file_extracted/word/document.xml | grep '<w:t>'

# Что искать:
# ✅ Если видите <w:t>текст</w:t> — текст присутствует
# ❌ Если только <w:drawing> или <w:pict> — только картинки
# ❌ Если файл не распаковывается — структура повреждена
```

---

### Шаг 3: Альтернативные инструменты

**Вариант A: pandoc (универсальный конвертер)**
```bash
sudo apt install pandoc
pandoc file.docx -t plain -o output.txt
cat output.txt
```

**Вариант B: python-docx**
```bash
pip install python-docx

python3 << 'EOF'
from docx import Document
doc = Document('file.docx')
for para in doc.paragraphs:
    print(para.text)
EOF
```

**Вариант C: antiword (легковесный)**
```bash
sudo apt install antiword
antiword file.docx > output.txt
```

---

### Шаг 4: Проверка метаданных

```bash
# Установите exiftool
sudo apt install libimage-exiftool-perl

# Посмотрите метаданные
exiftool file.docx

# Обратите внимание на:
# - Creator (кем создан)
# - Software (какая программа)
# - Encrypted (зашифрован ли)
```

---

## 🎨 Специальные случаи

### Файл с только изображениями → Используйте OCR

```bash
# 1. Конвертируйте в PDF
libreoffice --headless --convert-to pdf file.docx

# 2. Извлеките текст с OCR
sudo apt install tesseract-ocr
pdftotext file.pdf output.txt
```

**Или онлайн:**
- https://www.onlineocr.net/
- https://www.newocr.com/

---

### Защищенный файл → Снимите защиту

```
1. Откройте в Word с паролем
2. File → Info → Protect Document → Remove Protection
3. File → Save As → file_unprotected.docx
4. Используйте новый файл
```

---

## ✨ Что исправлено в версии 1.0.12

### Улучшенная диагностика

**Было:**
```
EmptyFileError: File is empty or contains no text
```

**Стало (v1.0.12+):**
```
EmptyFileError: File "file.docx" (DOCX, 916.02 KB) contains no extractable text.
Possible reasons:
  (1) File contains only images/graphics without text
  (2) File is password-protected or encrypted
  (3) File structure is corrupted
  (4) File was created with a non-standard application
Try: Open file in original application and verify it contains text, then save it again.
```

### Улучшенная обработка DOCX парсеров

- Явная обработка пустых строк от парсеров
- Детальная информация об ошибках обоих парсеров (officeparser + mammoth)
- Лучшая диагностика для troubleshooting

---

## 🚀 Обновление ноды до версии 1.0.12+

### Через n8n UI (рекомендуется)

```
1. Откройте n8n
2. Settings → Community Nodes
3. Найдите @mazix/n8n-nodes-converter-documents
4. Нажмите Update
5. Перезапустите n8n
```

### Через npm

```bash
npm update @mazix/n8n-nodes-converter-documents
```

### Ручное обновление

```bash
cd ~/n8n-node-converter-documents
git pull
npm run build
cp dist/* ~/.n8n/custom-nodes/n8n-node-converter-documents/
```

---

## 📚 Дополнительные ресурсы

- **OCR Guide:** `docs/ocr_example.md` — примеры распознавания текста
- **Security:** `docs/security.md` — вопросы безопасности
- **YML Support:** `docs/yml_support.md` — работа с Yandex Market каталогами

---

## 🆘 Поддержка

**GitHub Issues:**
https://github.com/mazixs/n8n-node-converter-documents/issues

**При создании Issue приложите:**
```bash
# Информация о файле
file file.docx
exiftool file.docx  # sudo apt install libimage-exiftool-perl

# Попытка распаковки (для DOCX)
unzip -l file.docx

# Версия ноды
npm list @mazix/n8n-nodes-converter-documents
```

---

## ⚠️ Известные ограничения

- ❌ Legacy форматы DOC/XLS/PPT (97-2003) не поддерживаются
- ❌ Текст в изображениях не извлекается (нужен OCR)
- ❌ Рукописный текст не распознается
- ❌ Файлы с DRM защитой не поддерживаются
- ⚠️ Очень большие файлы (>50MB) могут вызвать проблемы с памятью

---

**Версия документа:** 1.0  
**Последнее обновление:** 2025-10-09  
**Применимо к версии ноды:** 1.0.12+
