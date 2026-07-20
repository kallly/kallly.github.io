# Save, Share & Load-Time Bootstrap

## Two formats, chosen automatically by size
- `createSaveData` — verbose, human-readable, used for the Save/Load textarea (`#jsonArea`) and localStorage autosave.
- `createCompactSaveData` — dictionary-encoded troop names/colors + tuple arrays, no repeated keys, smaller.

`UIController.handleShareUrl()` tries verbose first, LZString-compressed into `?data=`; falls back to compact only if the verbose URL would be too long.

`parseSaveData` auto-detects shape (`version: 2` + a `t` array ⇒ compact) and expands compact back to the verbose shape **before anything else touches it** — `loadFromData`/collab code never needs to know which format was used. Preserve this: don't add a branch elsewhere that assumes one format.

## What's in a save
Verbose/compact payloads include `mapName`, placed troops, drawn zones (`PolygonModel`), and text labels (`TextLabelModel`). They do **not** include the traced enemy path (`PathModel`) — see [admin-mode.md](admin-mode.md).

## Load-time bootstrap priority (`app.js`)
1. `?data=` — LZString share link (highest priority)
2. `?map=<mapName>` — pre-selects a map, used by `pages/*.html` guide pages' "open in mapper" CTA buttons
3. localStorage autosave
4. first map in `data/maps.json`

## Map identifiers
`mapName` values are `data/maps.json` keys, used verbatim — including the `"Wrecked Battlefiel"` typo. See [../data/maps-and-troops.md](../data/maps-and-troops.md).
