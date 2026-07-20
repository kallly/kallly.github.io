# model/

No DOM access. Four of these six share one event pattern (see [../architecture.md](../architecture.md#the-event-system-is-the-backbone)) — extend that pattern, don't invent a new one.

## `TroopModel` — no events
Static lookup over `troops.json` (collision radius, range multiplier per troop/level). No mutation, no `onChange`.

## `MapModel` — no events
Holds the current map's image, zoom, and pan offset. Owns coordinate conversion: `screenToWorld(x, y)`, `worldToScreen(x, y)`, `scale`, `zoomAt(screenX, screenY, factor, canvas)` (shared by mouse-wheel and pinch-zoom in `InputController`).

## `PlacementModel` — `onChange`/`emitChange`
The list of placed troops + current selection. Origin of the `{type: "add"|"remove"|"update"|"clear", placement, previous}` event shape every other stateful model below copies. Subscribers: `CanvasRenderer`, `CollabController`, `HistoryController`, `UIController`.

## `PolygonModel` — `onChange`/`emitChange`
Admin-drawn zones (`polygon.points`: `[{x,y}, ...]` in world coords). **Included** in save/share data (unlike `PathModel` below). Used by `placementOptimizer.js` to know where a tower may be auto-placed.

## `TextLabelModel` — `onChange`/`emitChange`
Admin-placed text labels (`{ text, x, y }`, 20-char max enforced on add). **Included** in save/share data. Hit-testing uses a fixed 18px world-space radius (`LABEL_HIT_RADIUS`), same logic as troop-collision hit testing.

## `PathModel` — `onChange`/`emitChange`
Admin-traced enemy path. **Deliberately excluded** from `saveService.js` entirely — never in `createSaveData`, never autosaved, never in a share URL. Session-only, viewed/edited via its own JSON textarea (`UIController.handleShowPathJson`/`handleApplyPathJson`), separate from the main Share & Save textarea. See [../decisions.md](../decisions.md) for why, and [../features/admin-mode.md](../features/admin-mode.md) for the isolation pattern to copy for any new admin-only model.
