# service/

No model/view imports — pure data, IO, and algorithms. This is the layer to add new game-data-processing logic to.

## `dataService`
Fetches `data/maps.json` and `data/troops.json` on startup. See [../data/maps-and-troops.md](../data/maps-and-troops.md).

## `saveService`
Two save/share shapes — `createSaveData` (verbose) and `createCompactSaveData` (dictionary-encoded) — plus `parseSaveData` (auto-detects which one it received) and localStorage autosave. Full detail: [../features/save-share-and-bootstrap.md](../features/save-share-and-bootstrap.md).

## `collabService`
Thin Firebase Realtime Database wrapper. Deliberately knows nothing about `model/`/`controller/` shapes — all `{troop, level, x, y, color, player}` ⇄ app-placement translation happens in `CollabController`, not here. See [../features/collaboration.md](../features/collaboration.md).

## `analysisService`
Lazily loads and caches `tds_stats.json`/`hardcore_data.json` (`loadAnalysisData()`, cached in module-level `cachedAnalysisData`) — only triggered by opening the admin Wave Analysis panel. Also owns `parseEnemySpeed()` for the free-text `Speed` field quirk (see [../data/hardcore-stats.md](../data/hardcore-stats.md)).

## `waveSimulationService`
The math behind Wave Analysis. `buildCoverageProfile(paths, towers, totalLength)` builds a DPS-vs-progress-fraction profile along the traced path(s) — expressed as a fraction of path progress (not time/distance) so one profile works for every enemy speed in a wave. `simulateWave(...)` runs a wave against that profile. Detail: [../features/wave-analysis.md](../features/wave-analysis.md).
