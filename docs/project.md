# Project Vision

## What it is
Browser-based map/tower-placement planner for the Roblox game *Tower Defense Simulator* (TDS). Players pick a map, place towers, save/share layouts via URL or JSON, and optionally collaborate in real time. Plain HTML/CSS/vanilla ES modules — no framework, no bundler-driven dev server, no backend beyond Firebase Realtime Database for collab.

## Deployment
Static site on GitHub Pages (`kallly.github.io`), repo root == site root. No CI/build pipeline: the committed `dist/app.min.js` *is* what ships (see [build-and-tooling.md](build-and-tooling.md)). Google Analytics tag embedded per-page in `pages/*.html`.

## Three kinds of pages in this repo
1. **The app** — `index.html`, the interactive mapper.
2. **Static SEO/marketing pages** — `pages/*.html` (About, FAQ, Privacy, Terms, Contact, Submit-strategy, one strategy guide per map, plus Hardcore-mode content). No shared templating; each duplicates its own `<head>`. See [folders.md](folders.md) and [features/hardcore-pages.md](features/hardcore-pages.md).
3. **Admin build** — `admin.html`, a near-verbatim clone of `index.html`'s body with admin-only tools unlocked by default. Not a separate bundle — the same `dist/app.min.js` powers both. See [features/admin-mode.md](features/admin-mode.md).

## Audience
Public, anonymous players. No accounts, no auth anywhere in the app — "admin mode" is a UI convenience toggle (`?admin=1`), not access control. Don't add auth-shaped guards expecting them to restrict access to anything.

## Hard constraints
- **JSON files under `data/` must never be edited by Claude.** They're hand-maintained game data (troop stats, map list, Hardcore wave/enemy data). If a task seems to need a data change, ask the user first.
- No test suite, no lint config, no CI — see [build-and-tooling.md](build-and-tooling.md) for what that implies for how changes get verified.

## Non-goals
- No user accounts or persistent server-side storage beyond the ephemeral Firebase collab rooms.
- No native mobile app — the touch support in `InputController` is for mobile *browsers*, not a packaged app.

## Where to go next
- System design → [architecture.md](architecture.md)
- Current priorities / known gaps → [state.md](state.md)
