# Documentation Index

Master map of `docs/`. Read only what your current task needs — each row says when to open it. Every doc links onward to more specific docs; don't jump ahead of the chain.

## Start here by task

| Task | Open |
|---|---|
| Orient on the project, its purpose, its constraints | [project.md](project.md) |
| Understand the overall system (layers, state, event flow) | [architecture.md](architecture.md) |
| Find which file owns a piece of behavior | [modules/index.md](modules/index.md) |
| Work on collaboration / real-time sync | [features/collaboration.md](features/collaboration.md) |
| Work on save/share/URL/autosave | [features/save-share-and-bootstrap.md](features/save-share-and-bootstrap.md) |
| Work on admin-only tooling (path, zones, labels, analysis) | [features/admin-mode.md](features/admin-mode.md) |
| Work on the Hardcore wave/damage-analysis admin panel | [features/wave-analysis.md](features/wave-analysis.md) |
| Work on the standalone hardcore SEO pages/charts | [features/hardcore-pages.md](features/hardcore-pages.md) |
| Read/change a JSON data file | [data/index.md](data/index.md) |
| Coding style / architectural rules to follow | [conventions.md](conventions.md) |
| Build, esbuild, dependencies, no-CI/no-test facts | [build-and-tooling.md](build-and-tooling.md) |
| Where things live on disk | [folders.md](folders.md) |
| What's in flight, known gaps, rough roadmap | [state.md](state.md) |
| Why something non-obvious was built the way it was | [decisions.md](decisions.md) |
| Notable past changes and their motivation | [changelog.md](changelog.md) |

## Full tree

```
docs/
├── project.md              vision, scope, audience, hard constraints
├── architecture.md         layers, shared state object, event system, data flow
├── folders.md              directory-by-directory map, incl. index/admin/pages duplication
├── conventions.md          code style + architecture rules to follow
├── build-and-tooling.md    esbuild commands, deps, no CI/tests/lint
├── state.md                current status, known gaps, roadmap notes
├── decisions.md            ADR-lite log of non-obvious technical decisions
├── changelog.md            important historical changes and why they happened
├── data/
│   ├── index.md            the 4 JSON files at a glance + the never-edit rule
│   ├── maps-and-troops.md  maps.json / troops.json shapes and quirks
│   └── hardcore-stats.md   hardcore_data.json / tds_stats.json shapes
├── modules/
│   ├── index.md            one line per src/ file, links to the layer doc
│   ├── model.md             TroopModel, MapModel, PlacementModel, PolygonModel, TextLabelModel, PathModel
│   ├── view.md               CanvasRenderer, SidebarView
│   ├── controller.md         InputController, UIController, CollabController, HistoryController
│   ├── service.md             dataService, saveService, collabService, analysisService, waveSimulationService
│   └── util.md                 geometry.js, lz-string.js, placementOptimizer.js
└── features/
    ├── admin-mode.md                 resolveAdminMode, index/admin.html sync rule, admin tool isolation pattern
    ├── collaboration.md              Firebase real-time sync flow
    ├── save-share-and-bootstrap.md   verbose/compact save formats, LZString, query-param load priority
    ├── wave-analysis.md              admin Wave Analysis panel + coverage-profile algorithm
    └── hardcore-pages.md             standalone hardcore_chart/hardcore_damage_forecast pages
```

## Maintenance

This index must list every file under `docs/` and stay one line per file. When you add/remove/rename a doc, update this file and, if relevant, the task table above.
