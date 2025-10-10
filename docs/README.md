# 📚 Документация n8n-node-converter-documents

Кастомный узел для n8n для конвертации документов различных форматов в JSON/текст.

---

## 📖 Оглавление

### 🎯 Для пользователей

- **[Troubleshooting](TROUBLESHOOTING.md)** — Решение проблем "File is empty or contains no text"
- **[Security](security.md)** — Вопросы безопасности и валидации
- **[YML Support](yml_support.md)** — Работа с Yandex Market каталогами
- **[OCR Example](ocr_example.md)** — Распознавание текста из изображений

### 🛠️ Для разработчиков

- **[SOLUTION.md](SOLUTION.md)** — Архитектура и техническое решение
- **[Testing Strategy](testing_strategy.md)** — Стратегия тестирования
- **[Optimization Plan](optimization_plan.md)** — План оптимизации
- **[Audit](audit.md)** — Аудит кода и безопасности

### 🚀 CI/CD и публикация

- **[npm Publish Setup](deployment/CI_CD_SETUP_COMPLETE.md)** — Настройка автоматической публикации
- **[NPM Tokens](NPM_TOKEN_COMPARISON.md)** — Типы npm токенов
- **[npm Publish Manual](NPM_PUBLISH_SETUP.md)** — Ручная публикация в npm

### 📦 Архив

Устаревшие документы для справки:

- **[archive/CLEANUP_DIST.md](archive/CLEANUP_DIST.md)** — Инструкция по очистке dist/ из git
- **[archive/FIX-COMMUNITY-NODE.md](archive/FIX-COMMUNITY-NODE.md)** — Исправление community node
- **[archive/clean_plan.md](archive/clean_plan.md)** — Старый план очистки
- **[archive/documentation_cleanup.md](archive/documentation_cleanup.md)** — План реорганизации документации

---

## 🚀 Быстрый старт

### Установка

```bash
# Через n8n UI (рекомендуется)
Settings → Community Nodes → @mazix/n8n-nodes-converter-documents

# Или через npm
npm install @mazix/n8n-nodes-converter-documents
```

### Использование

1. Добавьте узел "Convert File to JSON" в workflow
2. Подключите файл из предыдущего узла
3. Настройте параметры (опционально)
4. Запустите workflow

### Поддерживаемые форматы

- **Документы:** DOCX, PDF, TXT, ODT
- **Таблицы:** XLSX, CSV, ODS
- **Презентации:** PPTX, ODP
- **Данные:** XML, JSON, YML, HTML

---

## 🆘 Получить помощь

### Проблемы с обработкой файлов

→ **[Troubleshooting](TROUBLESHOOTING.md)** — полное руководство по диагностике

### GitHub Issues

https://github.com/mazixs/n8n-node-converter-documents/issues

### Вопросы безопасности

→ **[Security](security.md)** — best practices и ограничения

---

## 🔧 Разработка

### Локальная установка

```bash
git clone https://github.com/mazixs/n8n-node-converter-documents.git
cd n8n-node-converter-documents
npm install
npm run build
```

### Запуск тестов

```bash
npm test
npm run test:coverage
```

### Создание standalone версии

```bash
npm run standalone
```

---

## 📊 Структура документации

```
docs/
├── README.md (этот файл)
│
├── TROUBLESHOOTING.md          ← Решение проблем
├── security.md                 ← Безопасность
├── yml_support.md              ← YML каталоги
├── ocr_example.md              ← OCR примеры
│
├── SOLUTION.md                 ← Архитектура
├── testing_strategy.md         ← Тестирование
├── optimization_plan.md        ← Оптимизация
├── audit.md                    ← Аудит
│
├── deployment/                 ← CI/CD документация
│   └── CI_CD_SETUP_COMPLETE.md
│
├── NPM_TOKEN_COMPARISON.md     ← npm токены
├── NPM_PUBLISH_SETUP.md        ← Публикация
│
└── archive/                    ← Архивные документы
    ├── CLEANUP_DIST.md
    ├── FIX-COMMUNITY-NODE.md
    ├── clean_plan.md
    └── documentation_cleanup.md
```

---

## 📝 Лицензия

MIT License — см. [LICENSE](../LICENSE)

---

## 🤝 Вклад в проект

Contributions welcome! См. архив для исторических документов по разработке.

---

**Версия:** 1.0.12  
**Последнее обновление:** 2025-10-09  
**GitHub:** https://github.com/mazixs/n8n-node-converter-documents
