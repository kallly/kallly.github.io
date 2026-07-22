# maps.json & troops.json

## `maps.json`
Keyed by map name, used **verbatim** everywhere a map is referenced: the `<select>` dropdown, the `?map=` query param each `pages/*.html` guide's "open in mapper" button uses, `mapName` in every saved layout (verbose and compact).

**`"Wrecked Battlefiel"` is a typo (missing the final "d") and must stay that way.** It's baked into existing external links and saved layouts; the *displayed* name is spelled correctly elsewhere (image filenames, page titles, guide page `WreckedBattlefield.html`) — only the JSON key is wrong, permanently. See [../decisions.md](../decisions.md).

Loaded by `dataService`, consumed by `MapModel`.

## `troops.json`
Per-troop: collision radius and range multiplier, used for placement validity checks and range-circle rendering. **Does not contain combat stats** (damage/DPS/fire rate) — those live in `tds_stats.json`, loaded separately and lazily, only for the Wave Analysis feature. See [hardcore-stats.md](hardcore-stats.md) and [../features/wave-analysis.md](../features/wave-analysis.md).

Loaded by `dataService`, consumed by `TroopModel`.
