# sync-kit

CLI утилита для переноса изменений кода между компьютерами через текстовые архивы.

Решает проблему синхронизации кода когда нет доступа к git remote — упаковывает изменения в ZIP-архив с текстовыми файлами, который можно перенести любым способом.

## Возможности

- Экспорт только изменённых файлов или полного снапшота
- Поддержка добавления, изменения, удаления и переименования файлов
- Автоматический бэкап перед импортом
- Определение и разрешение конфликтов
- Интерактивный выбор файлов
- Красивый терминальный интерфейс

---

## Быстрый старт

### Установка на основном компьютере

```bash
cd /path/to/sync-kit
npm install
npm run bundle
```

### Перенос на другой компьютер

Скопируй **один файл**:
```
sync-kit/bundle/sync-kit.mjs  (2.6 MB)
```

На другом компьютере положи его куда удобно (например `~/bin/`) и создай алиас:

```bash
# ~/.zshrc или ~/.bashrc
alias sk="node ~/bin/sync-kit.mjs"
```

---

## Использование

### Экспорт изменений

```bash
# Перейди в репозиторий
cd /path/to/my-project

# Интерактивный режим — покажет изменения и спросит что включить
sk export

# Быстрый экспорт без вопросов
sk q

# Полный снапшот всего проекта
sk export --full

# С описанием изменений
sk export -m "Фикс бага авторизации"

# Исключить файлы
sk export --exclude "*.test.ts" --exclude "docs/*"

# Указать путь для архива
sk export -o ./my-changes.zip
```

**Результат:** создаётся файл `sync_YYYYMMDD-HHMMSS.zip`

### Импорт изменений

```bash
# Перейди в репозиторий на другом компьютере
cd /path/to/my-project

# Посмотреть что в архиве (без изменений)
sk preview ./sync_20260115.zip

# Предпросмотр — что будет сделано
sk import --dry-run ./sync_20260115.zip

# Применить изменения
sk import ./sync_20260115.zip

# Без создания бэкапа
sk import --no-backup ./sync_20260115.zip

# Принудительно без подтверждений
sk import --force ./sync_20260115.zip
```

### История

```bash
# Показать историю синхронизаций
sk history

# Очистить историю
sk history --clear
```

---

## Команды

| Команда | Описание |
|---------|----------|
| `sk export` | Экспорт изменений (интерактивно) |
| `sk q` | Быстрый экспорт без вопросов |
| `sk export --full` | Экспорт всего проекта |
| `sk import <file>` | Импорт архива |
| `sk preview <file>` | Просмотр содержимого архива |
| `sk history` | История синхронизаций |

### Флаги export

| Флаг | Описание |
|------|----------|
| `-c, --changes` | Только изменённые файлы (по умолчанию) |
| `-f, --full` | Полный снапшот репозитория |
| `-q, --quick` | Без интерактивных вопросов |
| `-o, --output <path>` | Путь для архива |
| `-m, --message <text>` | Описание изменений |
| `-e, --exclude <pattern>` | Исключить файлы (можно несколько раз) |
| `-i, --include <pattern>` | Включить только указанные файлы |

### Флаги import

| Флаг | Описание |
|------|----------|
| `-t, --target <dir>` | Целевая директория |
| `-d, --dry-run` | Показать что будет сделано |
| `-n, --no-backup` | Не создавать бэкап |
| `-f, --force` | Без подтверждений |

---

## Структура архива

```
sync_20260115-143022.zip
├── manifest.json           # Метаданные и список операций
├── meta/
│   └── info.txt           # Человекочитаемая сводка
└── files/
    ├── src/
    │   ├── App.tsx.txt
    │   └── components/
    │       └── Button.tsx.txt
    └── ...
```

### Формат manifest.json

```json
{
  "version": "1.0",
  "created": "2026-01-15T14:30:22.000Z",
  "source": {
    "repo": "my-project",
    "branch": "feature/new-widget",
    "commit": "abc123d",
    "dirty": true
  },
  "mode": "changes",
  "message": "Описание изменений",
  "stats": {
    "added": 2,
    "modified": 3,
    "deleted": 1,
    "renamed": 1,
    "totalSize": 12345
  },
  "operations": [
    { "type": "add", "path": "src/NewFile.ts", "size": 1234, "hash": "sha256:..." },
    { "type": "modify", "path": "src/App.tsx", "size": 5678, "hash": "sha256:..." },
    { "type": "delete", "path": "src/OldFile.ts" },
    { "type": "rename", "from": "src/foo.ts", "to": "src/bar.ts", "size": 890 }
  ]
}
```

---

## Автоматически исключаемые файлы

- `node_modules/`
- `.git/`
- `dist/`, `build/`, `.next/`, `.nuxt/`
- `coverage/`
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`
- `.env`, `.env.*`
- `*.zip`
- `.sync-backup/`, `.sync-history/`

---

## Типичные сценарии

### Сценарий 1: Перенос текущих изменений

```bash
# На исходном компьютере
cd ~/projects/my-app
sk q
# Создан: sync_20260115-143022.zip

# Перенеси архив на другой компьютер

# На целевом компьютере
cd ~/projects/my-app
sk import ./sync_20260115-143022.zip
```

### Сценарий 2: Полная синхронизация проекта

```bash
# На исходном компьютере
sk export --full -m "Полный снапшот проекта"

# На целевом компьютере
sk import --force ./snapshot_20260115.zip
```

### Сценарий 3: Выборочный экспорт

```bash
# Только файлы из src/components
sk export --include "src/components/**"

# Всё кроме тестов
sk export --exclude "**/*.test.ts" --exclude "**/*.spec.ts"
```

---

## Требования

- Node.js 20+
- Git (в репозитории)

---

## Разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev -- export

# Сборка TypeScript
npm run build

# Сборка в один файл
npm run bundle
```

## Структура проекта

```
sync-kit/
├── bundle/
│   └── sync-kit.mjs      # Собранный бандл (один файл)
├── src/
│   ├── index.ts          # Entry point
│   ├── cli.ts            # CLI команды
│   ├── commands/         # Реализация команд
│   ├── core/             # Бизнес-логика
│   ├── ui/               # Терминальный интерфейс
│   ├── utils/            # Утилиты
│   └── types/            # TypeScript типы
├── bin/
│   └── sk                # Shell-скрипт для запуска
├── package.json
└── tsconfig.json
```

---

## Лицензия

MIT
