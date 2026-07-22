# Admin Mode

Pure UI convenience toggle — **not access control**. There is no auth anywhere in this app.

## How it's resolved
`resolveAdminMode()` at the top of `app.js`: always on for `admin.html` (its `<body>` hardcodes `class="admin-mode"`), toggleable on `index.html` via `?admin=1`/`?admin=0`, persisted to `localStorage["tds-mapper-admin"]` so the query param only needs typing once.

## One bundle, two HTML entry points
`dist/app.min.js` powers both `index.html` and `admin.html` — there is no separate admin build. Admin-only markup exists **verbatim in both HTML files**, wrapped in `.admin-only`, hidden via CSS unless `body.admin-mode` is present. This is the markup that must be hand-kept in sync (see [../folders.md](../folders.md)).

## Current admin-only surface
- Toolbar buttons (`#canvasTools`, admin-only): trace path (`tracePath`), auto-optimize placement in a zone (`optimizePlacement`), open Wave Analysis (`openAnalysis`).
- Sidebar section (admin-only): "Enemy Path (Admin)" — view/apply path JSON via its own textarea, separate from the main Share & Save textarea.
- Wave Analysis panel (`#analysisPanel`) — see [wave-analysis.md](wave-analysis.md).
- Zone drawing (`PolygonModel`) and label placement (`TextLabelModel`) tools are admin-gated in the UI but, unlike the path, their *data* is not admin-only — it ends up in every save/share payload. Only the *tool to create/edit* them is admin-gated.

## The isolation pattern for admin-only data
`PathModel` is the template: never referenced by `saveService.js`, never autosaved, never in a share URL — session-only, round-tripped through its own JSON textarea (`UIController.handleShowPathJson`/`handleApplyPathJson`). **Any future admin feature whose data shouldn't leak to normal users' saves must follow this same isolation**, rather than being folded into the existing save shape and merely hidden from view. Zones/labels intentionally did *not* follow this pattern — they're map-annotation tools useful to any user, not admin-only reasoning aids — see [../decisions.md](../decisions.md).
