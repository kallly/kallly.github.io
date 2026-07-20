# Changelog (rationale, not a commit log)

For the literal history, use `git log`. This file only records changes whose *motivation* isn't obvious from a diff or commit message — keep entries to 1-3 lines, newest first.

- **Admin tooling expansion** (zones, labels, placement optimizer, wave analysis panel) — grew `admin.html`/`index.html`'s admin-only surface well past the original path-tracing feature; see [state.md](state.md) for what's landed and [features/admin-mode.md](features/admin-mode.md)/[features/wave-analysis.md](features/wave-analysis.md) for how each works.
- **Hardcore-mode analysis pages added as standalone pages, not app features** — `pages/hardcore_chart.*` and `pages/hardcore_damage_forecast.*` deliberately live outside `src/`'s bundle despite reusing data (`data/hardcore_data.json`, `data/tds_stats.json`) similar to the in-app Wave Analysis panel; they're public SEO content, not admin tools. See [features/hardcore-pages.md](features/hardcore-pages.md).
