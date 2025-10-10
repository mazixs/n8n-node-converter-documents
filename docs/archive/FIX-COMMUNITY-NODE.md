# Исправление ошибки "The specified package does not contain any nodes"

## Проблема
При попытке установить пакет `@mazix/n8n-nodes-converter-documents` через веб-интерфейс n8n возникала ошибка:
```
The specified package does not contain any nodes
```

## Причина
В `package.json` отсутствовали необходимые поля для n8n community nodes:
1. Ключевое слово `"n8n-community-node-package"` в `keywords`
2. Поле `"n8n"` с правильной структурой
3. Описание пакета

## Решение

### 1. Добавлены keywords
```json
"keywords": [
  "n8n-community-node-package",
  "n8n",
  "document-converter",
  "file-converter",
  "pdf",
  "excel",
  "word",
  "powerpoint",
  "csv",
  "xml",
  "html"
]
```

### 2. Добавлено поле n8n
```json
"n8n": {
  "n8nNodesApiVersion": 1,
  "nodes": [
    "dist/FileToJsonNode.node.js"
  ]
}
```

### 3. Добавлены peerDependencies
```json
"peerDependencies": {
  "n8n-workflow": "*"
}
```

### 4. Добавлено описание
```json
"description": "n8n node to convert various document formats (DOC, DOCX, XML, XLS, XLSX, CSV, PDF, TXT, PPT, PPTX, HTML/HTM) to JSON or text format"
```

## Результат
✅ Пакет версии 1.0.4 теперь корректно устанавливается через веб-интерфейс n8n  
✅ n8n правильно распознает ноду в пакете  
✅ Нода появляется в списке доступных нод после установки  

## Проверка
1. Откройте n8n веб-интерфейс
2. Перейдите в Settings → Community nodes
3. Введите: `@mazix/n8n-nodes-converter-documents`
4. Нажмите Install
5. После установки нода "File to JSON Converter" должна появиться в списке нод

## Документация
Структура package.json для n8n community nodes описана в [официальной документации n8n](https://docs.n8n.io/integrations/creating-nodes/build/) 