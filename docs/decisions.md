# Technical Decisions

Append-only log of non-obvious choices and why. One entry per decision; newest at top. Skip anything already fully explained by a doc elsewhere — link instead of duplicating.

## Path tracing (and only path tracing) stays out of saveService
Zones (`PolygonModel`) and labels (`TextLabelModel`) are included in save/share/autosave; `PathModel` deliberately is not. **Why:** enemy paths are an admin analysis aid tied to the current session, not something a normal player's save should carry. **Applies to:** any future admin-only feature — default to isolating it like `PathModel` unless there's a specific reason players should get it in their saves (zones/labels earned inclusion because they're map-annotation tools useful to any user, not just admins reasoning about paths).

## Firebase auth kicked off without await
`initCollab()` is called but not awaited early in `app.js`, before map/troop data loads. **Why:** keeps Firebase's auth round-trip off the critical rendering path; the app can start rendering before collab is ready. It's only awaited immediately before `canvasRenderer.start()`. **Applies to:** don't refactor this to `await initCollab()` at the top of startup — that would reintroduce a network-bound delay before first paint.

## Two save/share formats instead of one
`createSaveData` (verbose) vs `createCompactSaveData` (dictionary-encoded). **Why:** verbose is human-readable (Save/Load textarea, localStorage) but too large for a URL once LZString-compressed for bigger layouts; compact trades readability for size. **Applies to:** `parseSaveData` must keep auto-detecting shape (`version: 2` + a `t` array ⇒ compact) so callers never need to know which format they got — don't add a code path that assumes one format.

## `admin.html` is a hand-synced clone, not a template or a second bundle
**Why:** the project has no templating system, and one shared `dist/app.min.js` powers both pages via a body class (`admin-mode`) rather than separate builds — simpler than introducing build-time templating for one extra page. **Applies to:** accept the manual-sync cost (see [features/admin-mode.md](features/admin-mode.md)) rather than proposing a templating engine for this alone.

## Map key `"Wrecked Battlefiel"` keeps its typo
**Why:** it's used verbatim as a dictionary key across `data/maps.json`, the map `<select>`, `?map=` query params in existing published guide-page links, and saved layouts. Fixing the typo would silently break every existing external link/save. **Applies to:** never "fix" this key; the *displayed* name is already spelled correctly elsewhere (image filenames, page titles) — only the JSON key is wrong, permanently.
