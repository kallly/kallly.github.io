# Standalone Hardcore Pages

`pages/hardcore_chart.html`+`.js` and `pages/hardcore_damage_forecast.html`+`.js` are public SEO/marketing content, like the rest of `pages/*.html` — but unlike every other page there, these two ship non-trivial standalone JS (367 and 660 lines) that is **not part of the `src/` bundle** and not built by esbuild.

## Why they're separate from the in-app Wave Analysis feature
They solve a public-facing version of a similar problem — forecasting Hardcore wave difficulty (damage needed per wave using the real in-game Wave Timer, detection-category requirements per wave, cash-per-wave for Solo/Duo/Trio) — but with no awareness of a specific player's placed towers, and no dependency on the app's models/controllers. They fetch `data/hardcore_data.json`/`data/tds_stats.json` independently. Do not try to unify them with `analysisService`/`waveSimulationService` (see [wave-analysis.md](wave-analysis.md)) without checking with the user first — they may be kept separate deliberately to stay linkable/indexable as standalone pages outside the app.

## Conventions specific to these two pages
Same per-page `<head>` duplication as other `pages/*.html` (GA tag, meta description/OG/Twitter tags, canonical URL, JSON-LD) — no shared templating exists anywhere in `pages/`. If asked to add a third such analysis page, follow this pair's structure rather than inventing a new one.
