# CLAUDE.md

Короткая шпаргалка по проекту для будущих сессий Claude Code. Подробное пользовательское описание — в `README.md`.

## Что это

`@itu_npm/sync-kit` — CLI-утилита (`sk` / `sync-kit`) для переноса изменений кода между компьютерами через ZIP-архивы, **когда нет доступа к git remote**. Упаковывает файлы в текстовый архив, на другой стороне распаковывает с разрешением конфликтов и бэкапом.

Стек: Node.js ≥20, TypeScript (strict, NodeNext ESM), commander, simple-git, archiver/adm-zip, inquirer, chalk, ora, boxen, picomatch.

## Команды для разработки

```bash
npm install
npm run dev -- export        # запуск через tsx без сборки
npm run build                # tsc → dist/, добавляет shebang в dist/index.js
npm run bundle               # esbuild → bundle/sync-kit.cjs (single-file CJS, executable)
npm run start                # node dist/index.js
npm test                     # vitest run (85 тестов, ~7 сек)
npm run test:watch           # vitest в watch-режиме
npm run binary               # @yao-pkg/pkg → bin/sync-kit-<platform>-<arch> под 5 платформ (~3-5 мин)
```

**CI/CD**: `.github/workflows/ci.yml` (тесты+билд на push/PR), `.github/workflows/release.yml` (при тегe `v*` — тесты → multi-platform binaries → GitHub Release с SHA256SUMS).

Тесты в `tests/` (vitest 4): `tests/unit/` — детерминированные функции (parsing, manifest, paths); `tests/integration/` — интеграционные с реальным git в `os.tmpdir()` через хелпер `tests/helpers/tmp-repo.ts`; CLI-уровень — child_process spawn через `tests/helpers/cli.ts`. UI-вывод в тестах глушится через `tests/setup.ts`. Покрыто: все 4 export mode'а, все фильтры, все стратегии истории (safe/ff/force/checkout/init-if-empty), все запрещённые комбинации флагов, conflict/backup/dry-run, rename/delete операции, preview с/без bundle, `sk q`/`sk history`.

## Структура

```
src/
├── index.ts                 # entry: createProgram() → parseAsync, глобальный try/catch
├── cli.ts                   # commander: регистрация export/import/preview/history/q
├── commands/                # сценарии команд (orchestration UI ↔ core)
│   ├── export.ts            # executeExport: detect → filter → manifest → archive
│   ├── import.ts            # executeImport: read → conflicts → backup → applyOperation
│   ├── preview.ts           # executePreview: показ manifest + контента
│   └── history.ts           # executeHistory: .sync-history/history.json
├── core/                    # бизнес-логика без UI
│   ├── git.ts               # simple-git singleton (initGit/getStatus/detectChanges/getAllFiles)
│   ├── archive.ts           # archiver (создание) + adm-zip (чтение)
│   ├── manifest.ts          # createManifest/parse/serialize + getManifestSummary
│   ├── diff.ts              # detectConflicts (один getStatus на батч), sortOperationsForApply
│   └── backup.ts            # .sync-backup/backup_<ts>/ перед import
├── ui/                      # терминальный UI
│   ├── theme.ts             # colors (chalk), symbols, getFileIcon (Nerd Font/emoji fallback)
│   ├── logger.ts            # success/warn/error/info, treeItem, section, bordered
│   ├── spinner.ts           # ora-обёртка с глобальным currentSpinner + withSpinner()
│   ├── prompts.ts           # inquirer: режим экспорта, выбор файлов/директорий, конфликты
│   ├── tree.ts              # displayFileTree, displayCompactTree
│   ├── table.ts             # cli-table3
│   ├── banner.ts            # ASCII-лого, displayResultCard (boxen)
│   ├── conflicts.ts         # карточки конфликтов
│   ├── progress.ts          # ProgressTracker / DetailedProgressTracker
│   └── history.ts           # displayHistoryGraph (timeline по датам)
├── utils/
│   ├── fs.ts                # обёртки fs/promises + hashFile (sha256:<hex>)
│   ├── paths.ts             # normalizePath (\→/), getArchiveFilePath, resolveSafePath
│   └── filters.ts           # picomatch: DEFAULT_EXCLUDES, MEDIA_EXCLUDES, createFileFilter
└── types/index.ts           # все интерфейсы: Manifest, FileOperation, Conflict, *Options
```

## Архитектурные принципы

- **Слои**: `cli → commands → core/ui/utils`. `core/` не импортирует `ui/`. UI — только в `commands/` и `ui/`.
- **simple-git как singleton**: `initGit(path)` инициализирует модульное состояние, далее всё через `getInitialized()`. Не пересоздавать SimpleGit per-call.
- **Пути**: всё внутри проекта в формате `/` (POSIX). `normalizePath()` применяется к выводу git. На диск пишем через `path.join`.
- **Хеши**: `sha256:<hex>` через `hashFile()`; используются для определения конфликтов и идемпотентности.
- **Сабмодули**: исключаются в `detectChanges` через `getSubmodules()` (mode `160000` в `git ls-files --stage`).
- **Архив**:
  - `manifest.json` — JSON-структура со списком операций
  - `meta/info.txt` — человекочитаемая сводка
  - `files/<original/path>.txt` — содержимое каждого файла (расширение `.txt` для портабельности — архив считается «текстовым»)
- **Операции**: `add | modify | delete | rename`. Применяются в порядке `delete → rename → modify → add` (`sortOperationsForApply`).
- **Конфликты**: один `git status` на весь батч (`detectConflicts`), не N+1. Причины: `modified_locally | deleted_locally | already_exists`.
- **Бэкап**: `.sync-backup/backup_<timestamp>/` создаётся перед `import` (если не `--no-backup`), сохраняет файлы, которые будут затронуты `modify/delete/rename`.

## Конвенции кода

- **ESM с явным `.js` в импортах**: `import { foo } from './bar.js';` (даже для `.ts`-исходников — требование `module: NodeNext`).
- **JSDoc** короткими блоками над публичными функциями; внутри функций комментарии минимальны.
- **Ошибки**: бросаем `Error` с понятным сообщением; команды ловят на верхнем уровне → `logger.error()` → `process.exit(1)`. Не глотать молча.
- **UI-сообщения — на английском** (см. logger/banner/prompts). Внутренние имена и идентификаторы — английские.
- **Стиль**: 2 пробела, single quotes, точка с запятой, trailing commas — следуй существующему коду.
- **Опции команд**: типизированные интерфейсы в `types/index.ts` (`ExportOptions`, `ImportOptions`, …). CLI-флаги маппятся в них в `cli.ts`.

## Точки расширения

Добавление новой команды:
1. Опции — в `types/index.ts`.
2. Файл `src/commands/<name>.ts` с `export async function execute<Name>(opts)`.
3. Регистрация в `src/cli.ts` (`.command().option().action()`).
4. Реиспользовать `core/*` и `ui/*`, не дублировать их.
5. Если нужны новые низкоуровневые операции git/архива — расширять соответствующий модуль `core/`, не делать ad-hoc в command-файле.

## Известные мелочи

- `README.md` упоминает `bundle/sync-kit.mjs`, реально билдится `bundle/sync-kit.cjs`.
- Папки `bin/` и `bundle/` в `.gitignore` — артефакты сборки в репо не коммитятся.
- `.sync-backup/` и `.sync-history/` создаются в целевом репо при импорте/экспорте и автоматически добавлены в `DEFAULT_EXCLUDES`.

## Перенос git-истории (since 1.1.0)

Поддерживается через `--with-history` / `--history-only` / `--history-strategy` — используется `git bundle` под капотом. Подробнее: `README.md` раздел «Перенос git-истории», план `docs/superpowers/plans/2026-04-27-git-history-transfer.md`.

Ключевые модули:
- `src/core/bundle.ts` — обёртки над `git bundle create | verify`, `git fetch <bundle>`, `git clone <bundle>`, `initRepo`/`isGitRepo`
- `src/types/index.ts` — `HistoryMetadata`, `BundleRef`, `HistoryStrategy`
- `meta/repo.pack` — имя bundle-файла внутри zip (нейтральное расширение, не `.bundle`)
- В `import.ts` bundle apply идёт **до** file overlay; `--checkout` использует `git checkout -f` чтобы синхронизировать WT после fast-forward/force fetch в текущую ветку.
- `findDefaultBranchRef(refs)` в `core/bundle.ts` определяет ветку source HEAD (по SHA из записи `HEAD` в bundle) — используется в `--init-if-empty` и `--checkout`. Bundle всегда создаётся с явным `HEAD` в args, чтобы запись HEAD попала в `git bundle verify` output.
