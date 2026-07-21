# Folder & File Map

Where things live, and why some things look duplicated.

```
index.html            the app (loads dist/app.min.js)
admin.html             near-verbatim clone of index.html's body, admin-mode always on
style.css              shared by index.html + admin.html (not pages/*.html, see below)
src/                   ES module source — see modules/index.md for file-by-file
dist/app.min.js        committed esbuild bundle; what index.html/admin.html actually load
data/*.json            hand-maintained game data — NEVER edit, see data/index.md
pages/*.html           static SEO/marketing pages, each with its own <head>, no shared templating
pages/*.js             standalone JS for a few pages only (hardcore_damage_forecast, towers) — NOT part of the src/ bundle, see features/hardcore-pages.md
.vscode/tasks.json     auto-starts `esbuild --watch=forever` on folder open
```

## `index.html` vs `admin.html`
Not templated — two real files. `admin.html`'s `#sidebar` and `#canvasTools` markup must be **hand-kept in sync** with `index.html` whenever either changes: both are actively developed, unlike the static `pages/*.html`. See [features/admin-mode.md](features/admin-mode.md) for exactly what's admin-gated.

## `pages/*.html`
Standalone marketing/SEO content: About, FAQ, Privacy, Terms, Contact, Submit-strategy, one strategy guide per map (`OutskirtsCommune.html`, `WreckedBattlefield.html`, `UnknownGarden.html`, `WretchedFront.html`), plus `TDS-Hardcore.html`, `hardcore_chart.html`, `hardcore_damage_forecast.html`, `towers.html`. Each guide page links back into the app via `?map=<mapName>` (see [features/save-share-and-bootstrap.md](features/save-share-and-bootstrap.md)). A few of these pages ship their own non-trivial JS — see [features/hardcore-pages.md](features/hardcore-pages.md).

## `style.css`
Mobile-first, shared only between `index.html`/`admin.html`. The left sidebar is an off-canvas drawer by default (checkbox-driven, no JS) and becomes a permanently docked flex child at `min-width: 900px`. The *same* hamburger checkbox/label drives opposite behavior depending on the media query — when touching drawer behavior, check both the base (mobile) rules and the `@media (min-width: 900px)` override block, not just one.

## `data/`
Four JSON files. Full shapes and quirks: [data/index.md](data/index.md).
