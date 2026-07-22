// Pas de personnalisation, contrairement aux zones.
const PATH_COLOR = "#ff3b3b";

export class CanvasRenderer {
    constructor(canvas, mapModel, placementModel, polygonModel, textLabelModel, pathModel, state) {
        this.canvas = canvas;
        this.mapModel = mapModel;
        this.placementModel = placementModel;
        this.polygonModel = polygonModel;
        this.textLabelModel = textLabelModel;
        this.pathModel = pathModel;
        this.state = state;
        this.ctx = this.canvas.getContext("2d");
        this.onRenderCallback = null;
        this.render = this.render.bind(this);
        this.imagesCache = {};
    }

    setRenderCallback(callback) {
        this.onRenderCallback = callback;
    }

    // Exporte à la résolution native de l'image (pas celle de l'écran) : dessine sur un canvas hors-DOM avec scale=1/offset=0, réutilisant drawMap/drawTroops tels quels puisqu'ils relisent this.ctx/this.mapModel.* à chaque appel.
    exportPng(filename = "tds-mapper-plan.png") {
        if (!this.mapModel.image.complete) {
            return;
        }

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = this.mapModel.image.width;
        exportCanvas.height = this.mapModel.image.height;

        const originalCtx = this.ctx;
        const { baseScale, zoom, offsetX, offsetY } = this.mapModel;

        this.ctx = exportCanvas.getContext("2d");
        this.mapModel.baseScale = 1;
        this.mapModel.zoom = 1;
        this.mapModel.offsetX = 0;
        this.mapModel.offsetY = 0;

        this.drawMap();
        this.drawPolygons();
        this.drawPaths();
        this.drawTroops();
        this.drawTextLabels();

        this.ctx = originalCtx;
        this.mapModel.baseScale = baseScale;
        this.mapModel.zoom = zoom;
        this.mapModel.offsetX = offsetX;
        this.mapModel.offsetY = offsetY;

        this.downloadCanvas(exportCanvas, filename);
    }

    downloadCanvas(canvas, filename) {
        try {
            const link = document.createElement("a");
            link.download = filename;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (error) {
            console.error("PNG export failed:", error);
            alert("Unable to export the map as PNG.");
        }
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.mapModel.resizeCanvas(this.canvas);
    }

    start() {
        this.render();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.clear();
        this.drawMap();
        this.drawPolygons();
        this.drawPaths();
        this.drawTroops();
        this.drawTextLabels();
        this.drawSelection();
        this.drawPlacementPreview();
        this.drawPolygonDraft();
        this.drawPathDraft();
        if (typeof this.onRenderCallback === "function") {
            this.onRenderCallback();
        }
        requestAnimationFrame(this.render)
    }

    drawMap() {
        if (!this.mapModel.image.complete) {
            return;
        }

        const width = this.mapModel.image.width * this.mapModel.scale;
        const height = this.mapModel.image.height * this.mapModel.scale;
        this.ctx.drawImage(this.mapModel.image, this.mapModel.offsetX, this.mapModel.offsetY, width, height);
    }

    drawPolygons() {
        for (const polygon of this.polygonModel.polygons) {
            this.drawPolygon(polygon);
        }
    }

    drawPolygon(polygon) {
        if (polygon.points.length < 3) {
            return;
        }

        const color = polygon.color || "#5b8cff";
        const isSelected = this.polygonModel.getSelected() === polygon;

        this.ctx.beginPath();
        const first = this.mapModel.worldToScreen(polygon.points[0].x, polygon.points[0].y);
        this.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < polygon.points.length; i++) {
            const point = this.mapModel.worldToScreen(polygon.points[i].x, polygon.points[i].y);
            this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.closePath();

        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.70
        this.ctx.fill();
        this.ctx.globalAlpha = 1;

        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.strokeStyle = isSelected ? "#00FF00" : color;
        this.ctx.stroke();
    }

    drawPaths() {
        for (const path of this.pathModel.paths) {
            this.drawPath(path);
        }
    }

    drawPath(path) {
        if (path.points.length < 2) {
            return;
        }

        const isSelected = this.pathModel.getSelected() === path;

        this.ctx.beginPath();
        const first = this.mapModel.worldToScreen(path.points[0].x, path.points[0].y);
        this.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < path.points.length; i++) {
            const point = this.mapModel.worldToScreen(path.points[i].x, path.points[i].y);
            this.ctx.lineTo(point.x, point.y);
        }

        this.ctx.lineWidth = isSelected ? 4 : 3;
        this.ctx.strokeStyle = isSelected ? "#00FF00" : PATH_COLOR;
        this.ctx.stroke();
    }

    // Marqueur sur le premier sommet indiquant où fermer la forme.
    drawPolygonDraft() {
        const draft = this.state.polygonDraftPoints;
        if (!this.state.isDrawingPolygon || !draft || draft.length === 0) {
            return;
        }

        const color = this.state.zoneColor || "#5b8cff";
        const first = this.mapModel.worldToScreen(draft[0].x, draft[0].y);

        this.ctx.beginPath();
        this.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < draft.length; i++) {
            const point = this.mapModel.worldToScreen(draft[i].x, draft[i].y);
            this.ctx.lineTo(point.x, point.y);
        }
        const pointer = this.mapModel.worldToScreen(this.state.pointerX, this.state.pointerY);
        this.ctx.lineTo(pointer.x, pointer.y);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = color;
        this.ctx.setLineDash([6, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.beginPath();
        this.ctx.arc(first.x, first.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    // Contrairement à drawPolygonDraft, jamais de marqueur de fermeture : un chemin est une polyligne ouverte.
    drawPathDraft() {
        const draft = this.state.pathDraftPoints;
        if (!this.state.isTracingPath || !draft || draft.length === 0) {
            return;
        }

        const first = this.mapModel.worldToScreen(draft[0].x, draft[0].y);

        this.ctx.beginPath();
        this.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < draft.length; i++) {
            const point = this.mapModel.worldToScreen(draft[i].x, draft[i].y);
            this.ctx.lineTo(point.x, point.y);
        }
        const pointer = this.mapModel.worldToScreen(this.state.pointerX, this.state.pointerY);
        this.ctx.lineTo(pointer.x, pointer.y);
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = PATH_COLOR;
        this.ctx.setLineDash([6, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawTroops() {
        for (const troop of this.placementModel.placedTroops) {
            this.drawTroop(troop);
        }
    }

    getTroopImage(troopName) {
        let imageName = troopName.replaceAll(" ", "").replace("(Top)", "").replace("(Bottom)", "");
        if (!this.imagesCache[imageName]) {
            let image = new Image();
            image.src = `images/troops/${imageName}.webp`;
            image.onload = () => {
                this.imagesCache[imageName] = image;
            };
            image.onerror = () => {
                image.src = "";
                this.imagesCache[imageName] = image;
            };
            return null;
        }
        return this.imagesCache[imageName];
    }

    // Le filtre joueur (state.playerFilter) est purement visuel : grise les troupes des autres joueurs sans toucher aux données de placement.
    drawTroop(troop) {
        const screen = this.mapModel.worldToScreen(troop.x, troop.y);
        const isDimmed = this.state.playerFilter && this.state.playerFilter !== "all" && troop.player !== this.state.playerFilter;

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
        this.ctx.fillStyle = isDimmed ? "#888888" : (troop.color || "#FFD54A");
        this.ctx.globalAlpha = isDimmed ? 0.35 : 0.7;
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "#222";
        this.ctx.stroke();

        let image = this.getTroopImage(troop.troop);
        if (image) {
            if (isDimmed) {
                this.ctx.filter = "grayscale(1)";
                this.ctx.globalAlpha = 0.45;
            }
            this.ctx.drawImage(
                image,
                screen.x - (troop.collision * this.mapModel.scale) * 1.7 / 2,
                screen.y - (troop.collision * this.mapModel.scale) * 1.7 / 2,
                troop.collision * this.mapModel.scale * 1.7,
                troop.collision * this.mapModel.scale * 1.7
            );
            if (isDimmed) {
                this.ctx.filter = "none";
            }
        }


        this.ctx.fillStyle = "white";
        this.ctx.font = `bold ${16 * this.mapModel.scale}px Arial`;
        this.ctx.textAlign = "center";
        if (this.state.showNames) {
            this.ctx.globalAlpha = isDimmed ? 0.5 : 1;
            this.ctx.fillText(troop.troop, screen.x, screen.y - troop.collision * this.mapModel.scale - 8);
        }

        this.ctx.globalAlpha = 1;
        if (this.state.showLevels) {
            this.ctx.fillStyle = "black";
            this.ctx.font = `bold ${20 * this.mapModel.scale}px Arial`;
            this.ctx.fillText("L" + troop.level, screen.x, screen.y + 6 * this.mapModel.scale);
        }
    }

    drawTextLabels() {
        for (const label of this.textLabelModel.labels) {
            this.drawTextLabel(label);
        }
        // Réinitialisé car le contexte persiste entre les rendus, et drawTroop suppose le textBaseline "alphabetic" implicite.
        this.ctx.textBaseline = "alphabetic";
    }

    drawTextLabel(label) {
        const screen = this.mapModel.worldToScreen(label.x, label.y);
        const fontSize = 16 * this.mapModel.scale;
        const isSelected = this.textLabelModel.getSelected() === label;

        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        const paddingX = 8 * this.mapModel.scale;
        const paddingY = 5 * this.mapModel.scale;
        const textWidth = this.ctx.measureText(label.text).width;

        this.ctx.fillStyle = isSelected ? "rgba(0,255,0,0.35)" : "rgba(0,0,0,0.55)";
        this.ctx.fillRect(
            screen.x - textWidth / 2 - paddingX,
            screen.y - fontSize / 2 - paddingY,
            textWidth + paddingX * 2,
            fontSize + paddingY * 2
        );

        this.ctx.fillStyle = "white";
        this.ctx.fillText(label.text, screen.x, screen.y);
    }

    // Portée toujours visible pour la troupe sélectionnée, même si l'affichage global des portées est désactivé.
    drawSelection() {
        const selected = this.placementModel.getSelected();
        if (!selected) {
            return;
        }

        const screen = this.mapModel.worldToScreen(selected.x, selected.y);

        if (!this.state.showRanges) {
            this.ctx.beginPath();
            this.ctx.arc(screen.x, screen.y, selected.range * this.mapModel.scale, 0, Math.PI * 2);
            this.ctx.fillStyle = "rgba(0,170,255,0.15)";
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "#00BFFF";
            this.ctx.stroke();
        }

        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, (selected.collision + 5) * this.mapModel.scale, 0, Math.PI * 2);
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = "#00FF00";
        this.ctx.stroke();
    }

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

        let image = this.getTroopImage(this.state.selectedTroop);
        if (image) {
            this.ctx.drawImage(
                image,
                screen.x - radius * 1.7 / 2,
                screen.y - radius * 1.7 / 2,
                radius * 1.7,
                radius * 1.7
            );
        }
    }
}
