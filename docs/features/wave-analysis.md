# Wave Analysis (admin)

Admin-only panel (`#analysisPanel`, opened via the `openAnalysis` toolbar button) that estimates whether currently placed towers can handle a chosen Hardcore wave.

## Data
Lazily loaded on first panel open via `analysisService.loadAnalysisData()` — fetches `data/tds_stats.json` (combat stats) and `data/hardcore_data.json` (wave/enemy roster) in parallel, caches the result so re-opening the panel doesn't re-fetch. See [../data/hardcore-stats.md](../data/hardcore-stats.md).

## Algorithm (`waveSimulationService.js`)
1. `buildCoverageProfile(paths, towers, totalLength)` walks every segment of the traced path(s) (`PathModel`), and for every placed tower whose range circle clips that segment (`geometry.segmentClipInCircle`), records where the tower's DPS turns on/off along the path.
2. These on/off events are swept in path order to produce a step function: DPS available as a **fraction of path progress** (0 = start, 1 = end) — not time or distance, so the same profile serves every enemy in the wave regardless of speed.
3. Enemy speed comes from `hardcore_data.json`'s free-text `Speed` field via `analysisService.parseEnemySpeed()` — flagged `approximate: true` when the raw value wasn't already a clean number, which the UI should surface rather than presenting as exact.
4. `simulateWave(...)` runs the wave's enemy composition against the coverage profile to estimate whether it survives.

## Relationship to the standalone hardcore pages
`pages/hardcore_chart.js`/`pages/hardcore_damage_forecast.js` solve a related but separate problem (public pre-computed forecasts using the game's real Wave Timer, no placed-tower awareness) and do not share code with this feature — see [hardcore-pages.md](hardcore-pages.md). Don't assume a change to one applies to the other.
