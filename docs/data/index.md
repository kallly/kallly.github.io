# Data Files at a Glance

**Hard rule: never edit any file in this folder.** They're hand-maintained by the user from external game-data sources. If a task seems to require a data change, stop and ask rather than editing.

| File | Size | Loaded by | Contents |
|---|---|---|---|
| `maps.json` | ~130 lines | `dataService` | map list: key, display name, image, dimensions. Detail: [maps-and-troops.md](maps-and-troops.md) |
| `troops.json` | ~800 lines | `dataService` | troop roster: collision radius, range multiplier — **not** combat stats |
| `tds_stats.json` | ~6500 lines | `analysisService` (lazy) | full combat stats per troop/level (damage, fire rate, DPS). Detail: [hardcore-stats.md](hardcore-stats.md) |
| `hardcore_data.json` | ~2000 lines | `analysisService` (lazy) | Hardcore mode wave/enemy roster (per-wave enemy composition, modifiers) |

## Why stats are split across two files
`troops.json` only has what the placement/collision UI needs (loaded eagerly, on every page load). `tds_stats.json` has full combat numbers, only needed by the admin Wave Analysis feature — loaded lazily via `analysisService.loadAnalysisData()`, cached after the first fetch, so normal players never pay for it. See [../features/wave-analysis.md](../features/wave-analysis.md).
