# Standalone Hardcore Pages

`pages/hardcore_damage_forecast.html`+`.js` is public SEO/marketing content, like the rest of `pages/*.html` — but unlike every other page there, it ships a non-trivial standalone JS file (600+ lines) that is **not part of the `src/` bundle** and not built by esbuild.

## Why it's separate from the in-app Wave Analysis feature
It solves a public-facing version of a similar problem — forecasting Hardcore wave difficulty (damage needed per wave using the real in-game Wave Timer, detection-category requirements per wave, cash-per-wave for Solo/Duo/Trio) — but with no awareness of a specific player's placed towers, and no dependency on the app's models/controllers. It fetches `data/hardcore_data.json`/`data/tds_stats.json` independently. Do not try to unify it with `analysisService` (see [wave-analysis.md](wave-analysis.md)) without checking with the user first — it may be kept separate deliberately to stay linkable/indexable as a standalone page outside the app.

One constant is deliberately duplicated rather than shared: `WAVE_TIMER_RANGES` (the official per-wave Hardcore Wave Timer) is hardcoded here (lines ~43-50) and also in `analysisService.js` for the in-app risk badge — same values except waves 43/45, see [../decisions.md](../decisions.md) for why. If the game's real Wave Timer values change, both copies need updating.

## Conventions specific to this page
Same per-page `<head>` duplication as other `pages/*.html` (GA tag, meta description/OG/Twitter tags, canonical URL, JSON-LD) — no shared templating exists anywhere in `pages/`. If asked to add a second such analysis page, follow this one's structure rather than inventing a new one.
