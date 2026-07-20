# Build & Tooling

## Commands
```bash
npm install                    # installs esbuild (dev) + firebase (runtime dep)
npx esbuild src/app.js --bundle --minify --outfile=dist/app.min.js                  # build once
npx esbuild src/app.js --bundle --minify --outfile=dist/app.min.js --watch=forever  # rebuild on save
```
No dev server needed — open `index.html` directly, or serve the repo root with any static file server. Module scripts require `http(s)://`, not `file://`.

`.vscode/tasks.json` auto-starts the `--watch=forever` build on folder open (VS Code prompts "Allow Automatic Tasks" once per machine).

## The one rule that matters most
**`dist/app.min.js` is committed to git and is what `index.html`/`admin.html` actually load** (`<script type="module" src="dist/app.min.js">`). There is no CI/build step. After editing anything under `src/`, manually rebuild and commit the new `dist/app.min.js`, or the deployed site keeps running the old bundle silently. There is no automated check that catches a stale bundle.

## Dependencies
- `esbuild` (dev) — the only build tool. No webpack/vite/rollup.
- `firebase` (runtime) — Realtime Database client for collaboration, see [features/collaboration.md](features/collaboration.md).
- `src/util/lz-string.js` — vendored (pieroxy LZString), **not** an npm dependency, imported as a plain ESM default export. Don't `npm install lz-string`; edit the vendored copy if it ever needs a fix.

## Absence of tests/lint/CI
None exist in this repo. Verification is manual: rebuild, open in-browser, exercise the changed flow. Don't invent a test command or lint script expectation — there isn't one to run.
