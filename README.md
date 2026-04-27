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

## Перенос git-истории

`sync-kit` умеет переносить полную историю коммитов через тот же ZIP-архив. Под капотом — `git bundle` (нативный механизм git, сохраняет все commit-хеши, ветки, теги).

### Экспорт с историей

```bash
# Архив с рабочими изменениями + историей всех веток и тегов
sk export --with-history

# Только история, без рабочих файлов
sk export --history-only

# Только определённые ветки в bundle
sk export --history-only --branches main develop

# История без тегов
sk export --history-only --no-tags
```

### Импорт с применением истории

```bash
# По умолчанию — safe: refs кладутся в refs/sync-kit/*, локальные ветки не трогаются
sk import archive.zip

# Обновить refs/heads/* (отказывается на non-fast-forward)
sk import archive.zip --history-strategy fast-forward

# Перезаписать refs/heads/* (DANGEROUS, может потерять локальные коммиты)
sk import archive.zip --history-strategy force

# После fetch синхронизировать рабочее дерево с новым HEAD
sk import archive.zip --history-strategy fast-forward --checkout

# Развернуть репо в пустую папку (init + fetch + checkout)
# Checkout-ится та ветка, что была HEAD на источнике
mkdir new-clone && sk import archive.zip -t ./new-clone --init-if-empty -f

# Игнорировать bundle, применить только файлы
sk import archive.zip --no-history
```

### Совместимость флагов

| Режим | `--with-history` | Поведение |
|---|---|---|
| `--changes` (по умолчанию) | да | дельты + bundle (главный сценарий двусторонней синхронизации) |
| `--full` | да | разрешено, но bundle избыточен (full уже содержит всё что в HEAD) |
| `--dirs` / `--include` / `--exclude` | да | **ошибка** — частичный перенос файлов несовместим с переносом истории |
| `--history-only` | n/a | только bundle, без файлов |

### Стратегии применения refs

- **safe** (по умолчанию): `git fetch <bundle> 'refs/heads/*:refs/sync-kit/*'`. Локальные ветки не трогаются. Дальше — `git merge refs/sync-kit/main` руками.
- **fast-forward**: `git fetch --update-head-ok <bundle> 'refs/heads/*:refs/heads/*'`. Стандартное поведение fetch — отказывается на non-fast-forward.
- **force**: `git fetch --update-head-ok <bundle> '+refs/heads/*:refs/heads/*'`. Перезаписывает локальные ветки. Используй осознанно.

### Что переносится

Bundle содержит:
- всю историю всех **локальных** веток (без `refs/remotes/*`)
- теги (если не передан `--no-tags`)
- все нужные git-объекты (commits, trees, blobs)

Bundle НЕ содержит: рабочее дерево, индекс, stash, hooks, конфиги. Working tree переносится отдельно через `files/` (стандартный flow sync-kit).

### Требование

На принимающей стороне должен быть установлен `git` в `PATH` — `sync-kit` использует его как backend.

---

## Команды

| Команда | Описание |
|---------|----------|
| `sk export` | Экспорт изменений (интерактивно) |
| `sk q` | Быстрый экспорт без вопросов |
| `sk export --full` | Экспорт всего проекта |
| `sk export --with-history` | Экспорт + git-история |
| `sk export --history-only` | Только git-история, без файлов |
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
| `--with-history` | Добавить git bundle (история всех локальных веток + теги) |
| `--history-only` | Bundle вместо файлов (`-c`/`-f`/`-D` запрещены) |
| `--branches <list...>` | Конкретные ветки/теги в bundle (по умолчанию — все локальные) |
| `--no-tags` | Не включать теги в bundle |

### Флаги import

| Флаг | Описание |
|------|----------|
| `-t, --target <dir>` | Целевая директория |
| `-d, --dry-run` | Показать что будет сделано |
| `-n, --no-backup` | Не создавать бэкап |
| `-f, --force` | Без подтверждений |
| `--no-history` | Игнорировать bundle в архиве |
| `--history-strategy <mode>` | `safe` (default) / `fast-forward` / `force` |
| `--checkout` | После fetch синхронизировать WT с новым HEAD |
| `--init-if-empty` | Если target не git-репо — `git init` + развернуть из bundle |

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

# Прогон тестов
npm test

# Сборка TypeScript
npm run build

# Сборка в один JS-файл (esbuild)
npm run bundle

# Сборка standalone-бинарей под все платформы (~3-5 минут)
npm run binary
# → bin/sync-kit-macos-arm64, bin/sync-kit-macos-x64,
#   bin/sync-kit-linux-x64, bin/sync-kit-linux-arm64,
#   bin/sync-kit-win-x64.exe (~48 MB каждый)
```

### Установка из бинаря (без Node.js)

Скачай нужную платформу из [GitHub Releases](https://github.com/itu-dev/sync-kit/releases):

```bash
# macOS arm64 пример
curl -L https://github.com/itu-dev/sync-kit/releases/latest/download/sync-kit-macos-arm64 -o /usr/local/bin/sk
chmod +x /usr/local/bin/sk
sk --version
```

На macOS при первом запуске может быть Gatekeeper warning — `Right-click → Open` один раз.

**Важно:** `git` всё равно должен быть в `PATH` — sync-kit вызывает его как backend.

### CI/CD

- `.github/workflows/ci.yml` — на каждый push/PR в `main`: vitest + tsc + esbuild
- `.github/workflows/release.yml` — при пуше тега `v*` (или вручную через `workflow_dispatch`): тесты → сборка бинарей под 5 платформ → GitHub Release с прикреплёнными бинарями и `SHA256SUMS.txt`

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
