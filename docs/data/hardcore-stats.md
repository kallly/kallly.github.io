# tds_stats.json & hardcore_data.json

Both are loaded lazily and only for Hardcore-mode analysis features — never on normal page load. Loading: `analysisService.loadAnalysisData()`, which fetches both in parallel and caches the result (`cachedAnalysisData`) after the first call.

## `tds_stats.json`
Full combat stats per troop, per upgrade level: damage, fire rate, computed DPS, plus a per-troop `detections: { hidden, lead, flying }` block. This is the file `troops.json` deliberately omits combat numbers from.

Consumed by: the in-app Wave Analysis panel (`analysisService`), and the standalone `pages/hardcore_damage_forecast.js` (which fetches it independently — it's outside the `src/` bundle, see [../features/hardcore-pages.md](../features/hardcore-pages.md)).

`detections.{hidden,lead,flying}` is free text (`"Level 2+"`, `"Level 0"`, `"Level 2+ (Tower & Tommy Goons)"`, `null` if never unlocked, etc.), not a clean number — `evaluateWaveDamage` reads it via `analysisService.parseDetectionLevel()` to decide whether a placed tower can hit a Hidden/Flying/Lead enemy at all (see [../features/wave-analysis.md](../features/wave-analysis.md) and the parsing-rule entry in [../decisions.md](../decisions.md)). Don't hand-parse this field elsewhere; go through that helper.

## `hardcore_data.json`
Hardcore mode's wave roster: `{ waves: [{ wave, enemies: [{ count, enemy, modifiers }] }], enemies: {...} }`. Enemy `Speed` fields are sometimes free text (e.g. `"Fast (6, With Balloon); Above Average (4, Without Balloon)"`) rather than a clean number — see `analysisService.parseEnemySpeed()`, which regex-extracts the first numeric token and flags the result `approximate: true` when it had to. Don't assume `Number(speed)` works; use that helper.

Each enemy also has `Hidden`/`Flying`/`Lead`/`Ghost` fields as free text (`"Yes"`, `"No"`, `"Yes (With covering)"`, `"Variable"`). `evaluateWaveDamage` reads `Hidden`/`Flying`/`Lead` via `analysisService.parseEnemyFlag()` (combined with the wave group's `modifiers`, since some enemies like Cursed Skeleton have a base value of `"Variable"` and only become Hidden when a wave's `modifiers` says so) to gate which towers can damage that enemy. `Ghost` is not read anywhere — no troop in `tds_stats.json` has a corresponding detection field for it.
