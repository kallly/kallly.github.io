# Current State

**Keep this file short and current — update it whenever a feature lands or a known gap closes.** Stale entries here are actively misleading; delete rather than accumulate.

## Recently landed (not yet reflected everywhere)
- Admin "Wave Analysis" panel (`analysisService.js`'s `evaluateWaveDamage`) — estimates whether currently placed towers handle a chosen Hardcore wave, via a static per-tower damage formula with overkill carried to the next enemy (not a time-based simulation — two earlier, more complex approaches were tried and abandoned, see [decisions.md](decisions.md)). See [features/wave-analysis.md](features/wave-analysis.md).
- Fixed a Wave Analysis bug where `carry` (overkill passed to the next enemy) propagated unconditionally and could snowball across a wave's weak enemies into enough phantom damage to "one-shot" a much later high-HP enemy, badly underestimating `clearTime`. Now gated on `timeDeficit > 0` (a real backlog), see [decisions.md](decisions.md).
- Two standalone Hardcore SEO pages with their own JS (`pages/hardcore_chart.*`, `pages/hardcore_damage_forecast.*`) — outside the `src/` bundle. See [features/hardcore-pages.md](features/hardcore-pages.md).
- Admin drawing tools beyond path tracing: `PolygonModel` (zones) and `TextLabelModel` (labels), plus `placementOptimizer.js` (auto-place a tower at the best spot in a drawn zone). Unlike `PathModel`, zones and labels **are** included in save/share data.
- `admin.html` received a round of updates in step with these ("Ajout de la partie admin") — check it's still in sync with `index.html`'s `#sidebar`/`#canvasTools` if you touch either.

## Known gaps / rough edges
- No automated way to detect a stale `dist/app.min.js` (see [build-and-tooling.md](build-and-tooling.md)) — purely procedural discipline.
- No tests — correctness for canvas/geometry/save-format code is verified by hand only.
- `admin.html` sync with `index.html` is manual and easy to forget; no lint/diff check enforces it.

## Roadmap notes
None tracked outside this file at time of writing — ask the user before assuming a direction; this repo has no issue tracker referenced elsewhere in-repo.
