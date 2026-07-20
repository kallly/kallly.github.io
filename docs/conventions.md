# Conventions & Architecture Rules

## Code style
- Vanilla ES modules, no build-time transpilation beyond esbuild's bundling/minification (no TS, no JSX).
- Inline comments are written in French in most existing files (model/service code); don't force-translate them when editing nearby, but new comments you add can be in either — match the file you're in.
- No lint config exists — match the surrounding file's style (semicolons, quoting, brace placement) rather than reformatting.
- Classes for stateful things with a lifecycle (models, controllers, views); plain exported functions for stateless logic (`service/`, `util/`).

## Architecture rules to follow
- **New cross-cutting concern (sync, logging, a second undo-like feature)?** Subscribe to the relevant model's `onChange` stream — don't add a call to it from inside `UIController`/`InputController`. See [architecture.md](architecture.md#the-event-system-is-the-backbone).
- **New mutation method on `PlacementModel`/`PolygonModel`/`TextLabelModel`/`PathModel`?** Populate `previous` in the `emitChange` call even if nothing currently reads it for that mutation type — `HistoryController` depends on it for undo.
- **New admin-only feature whose data shouldn't reach normal users' saves?** Follow `PathModel`'s pattern: keep it out of `saveService.js` entirely (never in `createSaveData`, never autosaved, never in a share URL) rather than folding it into the existing save shape and gating only the *display* of it. See [features/admin-mode.md](features/admin-mode.md).
- **Touching `index.html`'s `#sidebar`/`#canvasTools`?** Make the same edit in `admin.html`. There is no templating to keep them in sync automatically.
- **New model that needs undo support?** Give it the same `onChange`/`emitChange({type, item, previous})` shape as the existing four, then add it as an optional constructor arg to `HistoryController` (default `null`) and wire it in `app.js`.
- Firebase auth (`initCollab()`) is intentionally fired without `await` in `app.js`, before data loads — don't "fix" this by awaiting it eagerly; it keeps the auth round-trip off the critical rendering path. It's only awaited right before `canvasRenderer.start()`.

## Verifying changes
No test suite, no lint, no CI (see [build-and-tooling.md](build-and-tooling.md)). Manual verification means: rebuild the bundle, open `index.html` (and `admin.html` if the change touches admin tools) via a static server or directly, exercise the changed flow in-browser.
