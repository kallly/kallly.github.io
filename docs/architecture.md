# Architecture

The big picture. For per-file detail see [modules/index.md](modules/index.md); for how a specific cross-cutting feature works end-to-end see [features/](features/).

## Layers (`src/`)
- **model/** — pure state + change-notification, no DOM. `TroopModel`, `MapModel`, `PlacementModel`, `PolygonModel`, `TextLabelModel`, `PathModel`. Detail: [modules/model.md](modules/model.md).
- **view/** — DOM/canvas only, no business logic. `CanvasRenderer` (rAF render loop), `SidebarView` (DOM refs + wiring). Detail: [modules/view.md](modules/view.md).
- **controller/** — wires input to model mutations. `InputController`, `UIController` (central hub), `CollabController`, `HistoryController`. Detail: [modules/controller.md](modules/controller.md).
- **service/** — no model/view knowledge, pure data/IO/algorithms. `dataService`, `saveService`, `collabService`, `analysisService`, `waveSimulationService`. Detail: [modules/service.md](modules/service.md).
- **util/** — `geometry.js`, vendored `lz-string.js`, `placementOptimizer.js`. Detail: [modules/util.md](modules/util.md).
- **app.js** — entry point: builds the shared `state` object, constructs everything in dependency order, resolves admin mode, handles query-param bootstrap.

## The event system is the backbone
Four models — `PlacementModel`, `PolygonModel`, `TextLabelModel`, `PathModel` — share one pattern: `onChange(callback)` / `emitChange(type, item, previous)` broadcasting `{type: "add"|"remove"|"update"|"clear", item, previous}` to every subscriber. `CollabController` and `HistoryController` are independent subscribers with no knowledge of each other — **this is the pattern to extend** when adding any new cross-cutting concern (undo, sync, logging...). Don't thread new logic through `UIController`/`InputController` call sites; subscribe to the relevant model's change stream instead. `previous` carries what's needed to invert a mutation — any new mutation method on one of these models must populate it too, or `HistoryController`'s undo silently breaks for that mutation.

This is *not* the same as `SidebarView`'s `on(name, callback)`/`dispatch(name, value)` — that one holds a single callback per named UI action (last registration wins), used only for view→controller wiring, no history/replay semantics.

## Shared mutable `state` object
A plain object (not a class), created once in `app.js`, passed into most constructors. Holds UI state (`selectedTroop`, `selectedLevel`, `playerColors`, `pointerX/Y`, `isPlacementValid`, current admin tool) and one cross-component coordination flag:
- **`state.isApplyingRemoteChange`** — set by `CollabController` while applying a mutation that came from Firebase. Both `CollabController.handleLocalChange` and `HistoryController.recordChange` check it to avoid rebroadcasting/recording remote mutations. Any new `onChange` subscriber that should only react to *local* user actions needs the same check.

## Undo covers four models, not one
`HistoryController` subscribes to `placementModel`, `polygonModel`, `textLabelModel`, and `pathModel`, tagging each recorded change with its source so undo replays it against the right model. Only `placementModel` is required; the other three are optional constructor args (`= null`) — pass `null` for a context where that model doesn't exist rather than skipping the wiring.

## What's isolated from what
Not everything a model tracks is saved/shared/synced. See [features/admin-mode.md](features/admin-mode.md) for which admin-only state (the traced path) is deliberately kept out of `saveService.js` entirely, versus which (zones, labels) *is* part of the save/share payload.

## Data flow at a glance
Query param / localStorage → `dataService` loads `maps.json`/`troops.json` → `app.js` constructs models → `UIController`/`InputController` wire user input into model mutations → models `emitChange` → `CanvasRenderer` redraws + `CollabController`/`HistoryController` react. See [features/save-share-and-bootstrap.md](features/save-share-and-bootstrap.md) for the load-priority order.
