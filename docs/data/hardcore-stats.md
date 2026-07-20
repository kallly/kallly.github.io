# tds_stats.json & hardcore_data.json

Both are loaded lazily and only for Hardcore-mode analysis features — never on normal page load. Loading: `analysisService.loadAnalysisData()`, which fetches both in parallel and caches the result (`cachedAnalysisData`) after the first call.

## `tds_stats.json`
Full combat stats per troop, per upgrade level: damage, fire rate, computed DPS, plus speed/detection fields for enemies (shared file — see next section). This is the file `troops.json` deliberately omits combat numbers from.

Consumed by: the in-app Wave Analysis panel (`analysisService` + `waveSimulationService`), and the standalone `pages/hardcore_chart.js` / `pages/hardcore_damage_forecast.js` (which fetch it independently — they're outside the `src/` bundle, see [../features/hardcore-pages.md](../features/hardcore-pages.md)).

## `hardcore_data.json`
Hardcore mode's wave roster: `{ waves: [{ wave, enemies: [{ count, enemy, modifiers }] }], enemies: {...} }`. Enemy `Speed` fields are sometimes free text (e.g. `"Fast (6, With Balloon); Above Average (4, Without Balloon)"`) rather than a clean number — see `analysisService.parseEnemySpeed()`, which regex-extracts the first numeric token and flags the result `approximate: true` when it had to. Don't assume `Number(speed)` works; use that helper.
