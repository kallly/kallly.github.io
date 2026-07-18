// Contrôleur des interactions utilisateur.
// Il gère la souris, le clavier et les événements de zoom/pan sur le canvas.
export class InputController {
    constructor({ canvas, mapModel, placementModel, polygonModel, troopModel, state, callbacks }) {
        this.canvas = canvas;
        this.mapModel = mapModel;
        this.placementModel = placementModel;
        this.polygonModel = polygonModel;
        this.troopModel = troopModel;
        this.state = state;
        this.callbacks = callbacks;
        this.mouse = { x: 0, y: 0 };
        // État du geste tactile en cours (un doigt = pan, deux doigts = pincement/zoom).
        this.touch = { mode: null, lastX: 0, lastY: 0, lastDistance: 0, moved: false };
        this.lastTouchEndTime = 0;
        this.attachEvents();
    }

    // Attache tous les écouteurs d'événements.
    attachEvents() {
        this.canvas.addEventListener("mousemove", (event) => this.handleMouseMove(event));
        // Après un geste tactile, le navigateur peut synthétiser un clic souris fantôme sur le
        // même point ; on l'ignore pour ne jamais poser une troupe en double (voir handleTouchEnd).
        this.canvas.addEventListener("click", () => {
            if (performance.now() - this.lastTouchEndTime < 500) {
                return;
            }
            this.handleClick();
        });
        this.canvas.addEventListener("contextmenu", (event) => this.handleContextMenu(event));
        this.canvas.addEventListener("wheel", (event) => this.handleWheel(event));
        document.addEventListener("keydown", (event) => this.handleKeyDown(event));

        // Tactile : un doigt pour déplacer/sélectionner/poser, deux doigts pour zoomer (pincement).
        this.canvas.addEventListener("touchstart", (event) => this.handleTouchStart(event), { passive: false });
        this.canvas.addEventListener("touchmove", (event) => this.handleTouchMove(event), { passive: false });
        this.canvas.addEventListener("touchend", (event) => this.handleTouchEnd(event), { passive: false });
        this.canvas.addEventListener("touchcancel", (event) => this.handleTouchCancel(event), { passive: false });
    }
    // Met à jour les coordonnées du pointeur et le mode d'aperçu.
    updatePointer(event) {
        this.updatePointerFromClient(event.clientX, event.clientY);
    }

    // Même logique que updatePointer, mais à partir de coordonnées client brutes (souris ou tactile).
    // Suppose que le canvas n'a ni bordure ni padding et n'est pas mis à l'échelle par le devicePixelRatio
    // (cf. CanvasRenderer.resize) : sinon les deltas tactiles (en pixels CSS) et offsetX/offsetY
    // (dans le même repère que canvas.width/height) cesseraient de coïncider.
    updatePointerFromClient(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = clientX - rect.left;
        this.mouse.y = clientY - rect.top;
        const world = this.mapModel.screenToWorld(this.mouse.x, this.mouse.y);
        this.state.pointerX = world.x;
        this.state.pointerY = world.y;
        this.updatePreviewValues();
    }

    // Calcule la portée et la validité de placement pour l'aperçu.
    updatePreviewValues() {
        if (!this.state.selectedTroop) {
            this.state.isPlacementValid = false;
            return;
        }

        this.state.previewRange = this.mapModel.rangeMapMult * this.troopModel.getRange(this.state.selectedTroop, this.state.selectedLevel);
        this.state.previewCollision = this.mapModel.collisionMapMult * this.troopModel.getCollision(this.state.selectedTroop);
        this.state.isPlacementValid = this.placementModel.isPositionFree(this.state.pointerX, this.state.pointerY, this.state.previewCollision);
        if (typeof this.callbacks?.onPreviewUpdate === "function") {
            this.callbacks.onPreviewUpdate();
        }
    }

    handleMouseMove(event) {
        this.updatePointer(event);
    }

    // Clic principal sur le canvas : sélection, placement, ou pose/fermeture d'une zone.
    handleClick() {
        const { pointerX, pointerY } = this.state;

        if (this.state.isDrawingPolygon) {
            this.handlePolygonDraftClick();
            return;
        }

        const clickedTroop = this.placementModel.findAt(pointerX, pointerY);

        if (clickedTroop) {
            this.placementModel.select(clickedTroop);
            this.polygonModel.select(null);
            if (typeof this.callbacks?.onSelectionChanged === "function") {
                this.callbacks.onSelectionChanged(clickedTroop);
            }
            return;
        }

        if (this.state.selectedTroop) {
            if (!this.state.isPlacementValid) {
                return;
            }

            const placement = {
                troop: this.state.selectedTroop,
                level: this.state.selectedLevel,
                x: pointerX,
                y: pointerY,
                collision: this.state.previewCollision,
                range: this.state.previewRange,
                player: this.state.selectedPlayer,
                color: this.state.playerTroopColors[this.state.selectedPlayer]?.[this.state.selectedTroop]
                    || this.state.playerColors[this.state.selectedPlayer]
                    || this.state.selectedColor
                    || "#FFD54A"
            };

            const placed = this.placementModel.add(placement);
            if (typeof this.callbacks?.onPlacementAdded === "function") {
                this.callbacks.onPlacementAdded(placed);
            }
            return;
        }

        const clickedPolygon = this.polygonModel.findAt(pointerX, pointerY);
        if (clickedPolygon) {
            this.polygonModel.select(clickedPolygon);
            if (typeof this.callbacks?.onZoneSelectionChanged === "function") {
                this.callbacks.onZoneSelectionChanged(clickedPolygon);
            }
            return;
        }

        this.placementModel.select(null);
        this.polygonModel.select(null);
        if (typeof this.callbacks?.onSelectionChanged === "function") {
            this.callbacks.onSelectionChanged(null);
        }
        if (typeof this.callbacks?.onZoneSelectionChanged === "function") {
            this.callbacks.onZoneSelectionChanged(null);
        }
    }

    // Ajoute un sommet au tracé en cours, ou referme la zone si on clique près du premier sommet.
    handlePolygonDraftClick() {
        const { pointerX, pointerY } = this.state;
        const draft = this.state.polygonDraftPoints;

        if (draft.length >= 3) {
            const first = this.mapModel.worldToScreen(draft[0].x, draft[0].y);
            const pointer = this.mapModel.worldToScreen(pointerX, pointerY);
            const pixelDistance = Math.hypot(pointer.x - first.x, pointer.y - first.y);
            if (pixelDistance <= 12) {
                this.finishPolygonDraft();
                return;
            }
        }

        draft.push({ x: pointerX, y: pointerY });
    }

    // Valide le tracé en cours en une nouvelle zone et quitte le mode dessin.
    finishPolygonDraft() {
        const points = this.state.polygonDraftPoints;
        this.state.polygonDraftPoints = [];
        this.state.isDrawingPolygon = false;

        const polygon = this.polygonModel.add({ color: this.state.zoneColor, points });
        if (typeof this.callbacks?.onZoneFinished === "function") {
            this.callbacks.onZoneFinished(polygon);
        }
    }

    // Abandonne le tracé en cours sans créer de zone, et quitte le mode dessin.
    cancelPolygonDraft() {
        this.state.polygonDraftPoints = [];
        this.state.isDrawingPolygon = false;
        if (typeof this.callbacks?.onZoneCancelled === "function") {
            this.callbacks.onZoneCancelled();
        }
    }

    // Clic droit : annule un tracé de zone en cours, sinon la sélection de placement.
    handleContextMenu(event) {
        event.preventDefault();

        if (this.state.isDrawingPolygon) {
            this.cancelPolygonDraft();
            return;
        }

        this.state.selectedTroop = null;
        this.placementModel.select(null);
        this.updatePreviewValues();
        if (typeof this.callbacks?.onSelectionChanged === "function") {
            this.callbacks.onSelectionChanged(null);
        }
    }

    // Roulette de la souris : zoom autour du pointeur.
    handleWheel(event) {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
        this.mapModel.zoomAt(this.mouse.x, this.mouse.y, factor, this.canvas);
        if (typeof this.callbacks?.onViewportChanged === "function") {
            this.callbacks.onViewportChanged();
        }
    }

    // Distance entre deux doigts (pour le pincement).
    getTouchDistance(touches) {
        return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

    // Point médian entre deux doigts, en coordonnées locales au canvas.
    getTouchMidpoint(touches) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
            y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
        };
    }

    // Début d'un geste tactile : un doigt prépare un tap/glisser, deux doigts préparent un pincement.
    // Un troisième doigt (paume, coque du téléphone...) gèle le geste plutôt que de le laisser indéfini.
    handleTouchStart(event) {
        event.preventDefault();

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.touch.mode = "pan";
            this.touch.lastX = touch.clientX;
            this.touch.lastY = touch.clientY;
            this.touch.moved = false;
            this.updatePointerFromClient(touch.clientX, touch.clientY);
        }
        else if (event.touches.length === 2) {
            this.touch.mode = "pinch";
            this.touch.lastDistance = this.getTouchDistance(event.touches);
            this.touch.moved = true;
        }
        else {
            this.touch.mode = null;
        }
    }

    // Déplacement tactile : un doigt déplace la vue, deux doigts zooment autour de leur point médian.
    handleTouchMove(event) {
        event.preventDefault();

        if (this.touch.mode === "pan" && event.touches.length === 1) {
            const touch = event.touches[0];
            const deltaX = touch.clientX - this.touch.lastX;
            const deltaY = touch.clientY - this.touch.lastY;

            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                this.touch.moved = true;
            }

            this.mapModel.pan(deltaX, deltaY);
            this.touch.lastX = touch.clientX;
            this.touch.lastY = touch.clientY;
            this.updatePointerFromClient(touch.clientX, touch.clientY);
            if (typeof this.callbacks?.onViewportChanged === "function") {
                this.callbacks.onViewportChanged();
            }
        }
        else if (this.touch.mode === "pinch" && event.touches.length === 2) {
            const distance = this.getTouchDistance(event.touches);
            const midpoint = this.getTouchMidpoint(event.touches);
            const factor = distance / this.touch.lastDistance;

            this.mapModel.zoomAt(midpoint.x, midpoint.y, factor, this.canvas);
            this.touch.lastDistance = distance;
            if (typeof this.callbacks?.onViewportChanged === "function") {
                this.callbacks.onViewportChanged();
            }
        }
    }

    // Fin d'un geste tactile : un tap sans glissement déclenche la sélection/le placement.
    handleTouchEnd(event) {
        event.preventDefault();
        this.lastTouchEndTime = performance.now();

        if (this.touch.mode === "pan" && !this.touch.moved) {
            this.handleClick();
        }

        this.resumeTouchAfterGesture(event);
    }

    // Annulation d'un geste (appel entrant, geste système...) : on réinitialise l'état sans
    // jamais déclencher de tap, contrairement à handleTouchEnd — le geste n'a pas été complété.
    handleTouchCancel(event) {
        event.preventDefault();
        this.lastTouchEndTime = performance.now();
        this.resumeTouchAfterGesture(event);
    }

    // Repart proprement selon le nombre de doigts restants après un touchend/touchcancel.
    resumeTouchAfterGesture(event) {
        if (event.touches.length === 0) {
            this.touch.mode = null;
        }
        else if (event.touches.length === 1) {
            // Sortie d'un pincement (ou d'un geste à 3+ doigts) : repart d'un pan
            // sans déclencher de tap fantôme au prochain relâchement.
            const touch = event.touches[0];
            this.touch.mode = "pan";
            this.touch.lastX = touch.clientX;
            this.touch.lastY = touch.clientY;
            this.touch.moved = true;
        }
        else {
            this.touch.mode = null;
        }
    }

    isMouseOnCanvas() {
        const element = document.activeElement;

        if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement
        ) {
            return false;
        }
        return true;
    }

    // Clavier : navigation de la carte, suppression et raccourcis.
    handleKeyDown(event) {
        const moveAmount = this.canvas.width * 0.05;
        let moved = false;

        if (this.isMouseOnCanvas(event) && !event.ctrlKey) {
            if (["q", "a", "ArrowLeft"].includes(event.key)) {
                this.mapModel.pan(moveAmount, 0);
                moved = true;
            }
            if (["d", "ArrowRight"].includes(event.key)) {
                this.mapModel.pan(-moveAmount, 0);
                moved = true;
            }
            if (["z", "w", "ArrowUp"].includes(event.key)) {
                this.mapModel.pan(0, moveAmount);
                moved = true;
            }
            if (["s", "ArrowDown"].includes(event.key)) {
                this.mapModel.pan(0, -moveAmount);
                moved = true;
            }
        }
        if (moved) {
            event.preventDefault();
            if (typeof this.callbacks?.onViewportChanged === "function") {
                this.callbacks.onViewportChanged();
            }
        }

        if (this.isMouseOnCanvas(event) && event.key === "Escape" && this.state.isDrawingPolygon) {
            event.preventDefault();
            this.cancelPolygonDraft();
        }

        if (this.isMouseOnCanvas(event) && event.key === "Enter" && this.state.isDrawingPolygon
            && this.state.polygonDraftPoints.length >= 3) {
            event.preventDefault();
            this.finishPolygonDraft();
        }

        if (this.isMouseOnCanvas(event) && event.key === "Delete") {
            const selected = this.placementModel.getSelected();
            if (selected) {
                this.placementModel.remove(selected);
                this.placementModel.select(null);
                if (typeof this.callbacks?.onSelectionChanged === "function") {
                    this.callbacks.onSelectionChanged(null);
                }
            } else {
                const selectedPolygon = this.polygonModel.getSelected();
                if (selectedPolygon) {
                    this.polygonModel.remove(selectedPolygon);
                    this.polygonModel.select(null);
                    if (typeof this.callbacks?.onZoneSelectionChanged === "function") {
                        this.callbacks.onZoneSelectionChanged(null);
                    }
                }
            }
        }

        // Ctrl+Z : uniquement hors saisie, pour laisser l'annulation native fonctionner dans les champs texte.
        if (this.isMouseOnCanvas(event) && event.ctrlKey && event.key.toLowerCase() === "z") {
            event.preventDefault();
            if (typeof this.callbacks?.onUndoRequested === "function") {
                this.callbacks.onUndoRequested();
            }
        }

        if (event.ctrlKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (typeof this.callbacks?.onSaveRequested === "function") {
                this.callbacks.onSaveRequested();
            }
        }

        if (event.ctrlKey && event.key.toLowerCase() === "l") {
            event.preventDefault();
            if (typeof this.callbacks?.onLoadRequested === "function") {
                this.callbacks.onLoadRequested();
            }
        }
    }
}
