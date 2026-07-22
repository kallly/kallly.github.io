# Collaboration (real-time sync)

`CollabController` + `collabService`, Firebase Realtime Database, anonymous auth. Room codes are short, human-typeable strings.

## Startup ordering (don't "fix" this)
`initCollab()` (in `app.js`) is fired without being awaited, before map/troop data loads — keeps Firebase's auth round-trip off the critical rendering path. It's only awaited immediately before `canvasRenderer.start()`. See [../decisions.md](../decisions.md).

## Division of responsibility
- `collabService.js` — thin Firebase wrapper. Never imports from `model/`/`controller/`; knows nothing about app-level placement shapes.
- `CollabController` — all translation between Firebase's wire shape `{troop, level, x, y, color, player}` and the app's placement objects happens here, and only here.

## Loop-prevention
`CollabController` subscribes to `placementModel.onChange`. When applying an incoming remote mutation, it sets `state.isApplyingRemoteChange = true` for the duration — this stops `HistoryController` from recording someone else's action into the local undo stack, and stops `CollabController.handleLocalChange` from rebroadcasting a change that just came from the network. Any new `onChange` subscriber that should react only to local actions must check this same flag (see [../architecture.md](../architecture.md)).

## Config
`src/config/firebaseConfig.js` — Firebase project keys. Not secret-sensitive in the way a server key would be (client-side Firebase config is expected to be public), but still don't rewrite it without the user's Firebase project details.
