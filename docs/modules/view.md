# view/

Pure rendering/DOM — no business logic, no direct model mutation (that's controllers' job).

## `CanvasRenderer`
rAF render loop drawing the map, placed troops (+ range circles), drawn zones, text labels, and (admin) the traced path. `resize()` reads `canvas.clientWidth/clientHeight` so the drawing buffer always matches the CSS-rendered size — call it whenever layout changes (e.g. sidebar drawer toggling on mobile), not just on window resize. `start()` kicks off the loop; called only after collab auth resolves (see [../architecture.md](../architecture.md)).

## `SidebarView`
Every sidebar/toolbar DOM element reference lives here, plus the `on(name, callback)`/`dispatch(name, value)` view→controller wiring — one callback per named action, last registration wins. Distinct from the model event system: no history, no replay, purely "a button was clicked, tell the controller." `UIController` is the only consumer that calls `on(...)`.
