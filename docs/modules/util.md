# util/

## `geometry.js`
Primitives used across models/services: `distance`, `pointInPolygon`, `distanceToSegment`, `polylineLength`, `segmentClipInCircle`, `segmentLengthInCircle`, `isCircleInPolygon`. `segmentClipInCircle` is what `waveSimulationService` uses to find where a path segment enters/exits a tower's range circle.

## `lz-string.js`
Vendored (pieroxy LZString), **not** an npm package — imported as a plain ESM default export. Used to compress the verbose save JSON into `?data=` share URLs. Edit the vendored copy directly if it ever needs a fix; don't try to `npm install` a replacement.

## `placementOptimizer.js`
`findBestPositionInPolygon({ points, isValid, score, yieldEvery })` — coarse-then-fine grid search (~40 steps coarse, ~8x finer refinement pass) for the point maximizing `score(x,y)` inside a drawn zone's bounding box, among points where `isValid(x,y)` holds. Yields to the event loop every `yieldEvery` evaluations (default 200) via `setTimeout(0)` so a large zone never blocks the main thread. Powers the admin "auto-place tower in zone" toolbar button.
