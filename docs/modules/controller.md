# controller/

Where input becomes model mutation. All four are constructed in `app.js` and given references to the models/views they coordinate — none of them talk to each other directly except through the model event system (see [../architecture.md](../architecture.md)).

## `InputController`
Canvas mouse/touch/keyboard input. Single finger = pan (drag) or tap-to-place/select (if it never moved past a small threshold); two fingers = pinch-zoom, reusing `mapModel.zoomAt()`. Routes clicks to whichever model is the active admin tool (placement, zone, label, path). `touchcancel` has its own handler, distinct from `touchend` — never let it fall through to tap-select/place. A `lastTouchEndTime` guard on the `click` listener suppresses a synthetic mouse click a WebView might replay after touch, to avoid double-placing.

## `UIController`
Central hub — the largest controller (674 lines). Wires `SidebarView` callbacks to actions: save/share, JSON load, map switching, admin panel open/close (path JSON, wave analysis). If you're looking for where a sidebar button's behavior lives, it's here. **Don't add new cross-cutting logic here** — subscribe to a model's `onChange` instead (see [../conventions.md](../conventions.md)).

## `CollabController`
Firebase real-time sync. Subscribes to `placementModel.onChange`; translates between Firebase's `{troop, level, x, y, color, player}` shape and app placements. Sets `state.isApplyingRemoteChange` while applying an incoming remote mutation so `HistoryController` doesn't record it and this controller doesn't rebroadcast it. See [../features/collaboration.md](../features/collaboration.md).

## `HistoryController`
Undo stack (`MAX_HISTORY = 50`) across `placementModel` (required) plus `polygonModel`/`textLabelModel`/`pathModel` (all optional, default `null` — pass `null` where a model doesn't exist). Tags each recorded change with its source model so undo replays against the right one. Skips recording while `isApplyingUndo` or `state.isApplyingRemoteChange` is set.
