// Composant de rendu pour le canvas.
// Il dessine la carte, les troupes, la sélection active et l'aperçu de placement.
export class CanvasRenderer {
    constructor(canvas, mapModel, placementModel, state) {
        this.canvas = canvas;
        this.mapModel = mapModel;
        this.placementModel = placementModel;
        this.state = state;
        this.ctx = this.canvas.getContext("2d");
        this.onRenderCallback = null;
        this.render = this.render.bind(this);
    }

    setRenderCallback(callback) {
        this.onRenderCallback = callback;
    }

    // Actualise la taille du canvas avec sa taille CSS.
    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.mapModel.resizeCanvas(this.canvas);
    }

    // Lance la boucle d'animation.
    start() {
        this.render();
    }

    // Efface la surface de dessin.
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Boucle de rendu principale.
    render() {
        this.clear();
        this.drawMap();
        this.drawTroops();
        this.drawSelection();
        this.drawPlacementPreview();
        if (typeof this.onRenderCallback === "function") {
            this.onRenderCallback();
        }
        requestAnimationFrame(this.render);
    }

    // Affiche l'image de la carte à l'endroit et à l'échelle.
    drawMap() {
        if (!this.mapModel.image.complete) {
            return;
        }

        const width = this.mapModel.image.width * this.mapModel.scale;
        const height = this.mapModel.image.height * this.mapModel.scale;
        this.ctx.drawImage(this.mapModel.image, this.mapModel.offsetX, this.mapModel.offsetY, width, height);
    }

    // Dessine toutes les troupes posées.
    drawTroops() {
        for (const troop of this.placementModel.placedTroops) {
            this.drawTroop(troop);
        }
    }

    // Dessine une troupe avec sa collision, sa portée et son étiquette.
    drawTroop(troop) {
        const screen = this.mapModel.worldToScreen(troop.x, troop.y);

        if (this.state.showRanges) {
            this.ctx.beginPath();
            this.ctx.arc(screen.x, screen.y, troop.range * this.mapModel.scale, 0, Math.PI * 2);
            this.ctx.fillStyle = "rgba(0,170,255,0.15)";
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "#00BFFF";
            this.ctx.stroke();
        }

        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, troop.collision * this.mapModel.scale, 0, Math.PI * 2);
        this.ctx.fillStyle = this.state.troopColors[troop.troop] || troop.color || "#FFD54A";
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "#222";
        this.ctx.stroke();

        this.ctx.fillStyle = "white";
        this.ctx.font = `bold ${16 * this.mapModel.scale}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.fillText(troop.troop, screen.x, screen.y - troop.collision * this.mapModel.scale - 8);

        this.ctx.fillStyle = "black";
        this.ctx.font = `bold ${13 * this.mapModel.scale}px Arial`;
        this.ctx.fillText("L" + troop.level, screen.x, screen.y + 4 * this.mapModel.scale);
    }

    // Dessine le cercle de sélection autour de la troupe actuelle.
    drawSelection() {
        const selected = this.placementModel.getSelected();
        if (!selected) {
            return;
        }

        const screen = this.mapModel.worldToScreen(selected.x, selected.y);
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, (selected.collision + 5) * this.mapModel.scale, 0, Math.PI * 2);
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = "#00FF00";
        this.ctx.stroke();
    }

    // Affiche l'aperçu de placement sous la souris.
    drawPlacementPreview() {
        if (!this.state.selectedTroop) {
            return;
        }

        const screen = this.mapModel.worldToScreen(this.state.pointerX, this.state.pointerY);
        const radius = this.state.previewCollision * this.mapModel.scale;
        const rangeRadius = this.state.previewRange * this.mapModel.scale;

        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, rangeRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.state.isPlacementValid ? "rgba(0,255,0,0.18)" : "rgba(255,0,0,0.18)";
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = this.state.isPlacementValid ? "#00ff00" : "#ff4444";
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.state.isPlacementValid ? "#00cc00" : "#ff3333";
        this.ctx.fill();
    }
}
