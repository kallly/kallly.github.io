// Contrôleur des interactions utilisateur.
// Il gère la souris, le clavier et les événements de zoom/pan sur le canvas.
export class InputController {
    constructor({ canvas, mapModel, placementModel, troopModel, state, callbacks }) {
        this.canvas = canvas;
        this.mapModel = mapModel;
        this.placementModel = placementModel;
        this.troopModel = troopModel;
        this.state = state;
        this.callbacks = callbacks;
        this.mouse = { x: 0, y: 0 };
        this.attachEvents();
    }

    // Attache tous les écouteurs d'événements.
    attachEvents() {
        this.canvas.addEventListener("mousemove", (event) => this.handleMouseMove(event));
        this.canvas.addEventListener("click", () => this.handleClick());
        this.canvas.addEventListener("contextmenu", (event) => this.handleContextMenu(event));
        this.canvas.addEventListener("wheel", (event) => this.handleWheel(event));
        document.addEventListener("keydown", (event) => this.handleKeyDown(event));
    }
    // Met à jour les coordonnées du pointeur et le mode d'aperçu.
    updatePointer(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
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

    // Clic principal sur le canvas : sélection ou placement.
    handleClick() {
        const { pointerX, pointerY } = this.state;
        const clickedTroop = this.placementModel.findAt(pointerX, pointerY);

        if (clickedTroop) {
            this.placementModel.select(clickedTroop);
            if (typeof this.callbacks?.onSelectionChanged === "function") {
                this.callbacks.onSelectionChanged(clickedTroop);
            }
            return;
        }

        if (!this.state.selectedTroop) {
            this.placementModel.select(null);
            if (typeof this.callbacks?.onSelectionChanged === "function") {
                this.callbacks.onSelectionChanged(null);
            }
            return;
        }

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
            color: this.state.troopColors[this.state.selectedTroop] || this.state.selectedColor || "#FFD54A"
        };

        const placed = this.placementModel.add(placement);
        if (typeof this.callbacks?.onPlacementAdded === "function") {
            this.callbacks.onPlacementAdded(placed);
        }
    }

    // Clic droit : annule la sélection de placement.
    handleContextMenu(event) {
        event.preventDefault();
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

    // Clavier : navigation de la carte, suppression et raccourcis.
    handleKeyDown(event) {
        const moveAmount = this.canvas.width * 0.05;
        let moved = false;
        
        if (this.mouse.x > 10) {
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

        if (event.key === "Delete") {
            const selected = this.placementModel.getSelected();
            if (selected) {
                this.placementModel.remove(selected);
                this.placementModel.select(null);
                if (typeof this.callbacks?.onSelectionChanged === "function") {
                    this.callbacks.onSelectionChanged(null);
                }
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
