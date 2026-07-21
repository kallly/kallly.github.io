# Modules at a Glance

One line per file. Open the layer doc linked for behavior/gotchas; open the source file only once you know exactly which function you need.

## model/ — see [model.md](model.md)
- `troopModel.js` (58 l) — troop stats lookup, no mutation events
- `mapModel.js` (139 l) — current map image, zoom/pan, `screenToWorld`/`worldToScreen`/`scale`
- `placementModel.js` (112 l) — placed troops + selection; `onChange`/`emitChange` origin of the pattern
- `polygonModel.js` (86 l) — drawn zones (admin), same event pattern
- `textLabelModel.js` (78 l) — map text labels (admin), same event pattern, 20-char max
- `pathModel.js` (97 l) — traced enemy path (admin), same event pattern, isolated from save/share

## view/ — see [view.md](view.md)
- `canvasRenderer.js` (421 l) — rAF render loop; `resize()` reads `canvas.clientWidth/Height`
- `sidebarView.js` (292 l) — all sidebar/toolbar DOM refs + `on`/`dispatch` wiring

## controller/ — see [controller.md](controller.md)
- `inputController.js` (549 l) — mouse/touch/keyboard canvas input, routes to whichever model is the active admin tool
- `uiController.js` (670 l) — central hub: sidebar wiring, save/share, map switching, admin panels
- `collabController.js` (147 l) — Firebase real-time sync, translates model ⇄ Firebase shapes
- `historyController.js` (96 l) — undo stack across 4 models

## service/ — see [service.md](service.md)
- `dataService.js` (43 l) — fetches `maps.json`/`troops.json`
- `saveService.js` (200 l) — verbose/compact save formats, localStorage autosave
- `collabService.js` (182 l) — thin Firebase wrapper, no model/view knowledge
- `analysisService.js` (131 l) — lazy-loads `tds_stats.json`/`hardcore_data.json`, `parseEnemySpeed`, `evaluateWaveDamage` (Wave Analysis)

## util/ — see [util.md](util.md)
- `geometry.js` (93 l) — distance/point-in-polygon/segment-circle primitives
- `lz-string.js` (506 l) — vendored compression, used for share URLs
- `placementOptimizer.js` (41 l) — grid search for best tower spot in a drawn zone

## config/
- `firebaseConfig.js` (14 l) — Firebase project config, see [../features/collaboration.md](../features/collaboration.md)

## Entry point
- `app.js` (454 l) — see [../architecture.md](../architecture.md)
