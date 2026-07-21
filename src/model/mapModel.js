import { polylineLength, segmentLengthInCircle } from "../util/geometry.js";

export class MapModel {
    constructor(maps = {}) {
        this.maps = maps;
        this.currentMap = null;
        this.image = new Image();
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.baseScale = 1;
    }

    setMaps(maps) {
        this.maps = maps;
    }

    async loadMap(mapName, canvas) {
        const mapData = this.maps[mapName];
        if (!mapData) {
            throw new Error(`Map not found: ${mapName}`);
        }

        this.currentMap = mapData;

        return new Promise((resolve, reject) => {
            this.image.onload = () => {
                this.updateBaseScale(canvas);
                resolve();
            };
            this.image.onerror = () => reject(new Error(`Impossible de charger l'image : ${mapData.url}`));
            this.image.src = mapData.url;
        });
    }

    updateBaseScale(canvas) {
        if (!canvas || !this.image.complete) {
            return;
        }

        const scaleX = canvas.width / this.image.width;
        const scaleY = canvas.height / this.image.height;

        this.baseScale = Math.min(scaleX, scaleY);
        this.offsetX = (canvas.width - this.image.width * this.scale) / 2;
        this.offsetY = (canvas.height - this.image.height * this.scale) / 2;
    }

    get scale() {
        return this.baseScale * this.zoom;
    }

    get rangeMapMult() {
        return this.currentMap?.rangeMapMult ?? 1;
    }

    get collisionMapMult() {
        return this.currentMap?.collisionMapMult ?? 1;
    }

    // [] si aucun "path" n'est défini (toutes les cartes sauf celles déjà tracées par un admin dans maps.json).
    getPaths() {
        return this.currentMap?.path?.paths || [];
    }

    getTotalPathLength() {
        return this.getPaths().reduce((total, path) => total + polylineLength(path.points), 0);
    }

    // null si absent (maps.json).
    getPathDuration() {
        return this.currentMap?.path?.duration ?? null;
    }

    getPathLengthInCircle(cx, cy, radius) {
        let total = 0;
        for (const path of this.getPaths()) {
            const points = path.points;
            for (let i = 0; i < points.length - 1; i++) {
                total += segmentLengthInCircle(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, cx, cy, radius);
            }
        }
        return total;
    }

    screenToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.scale,
            y: (y - this.offsetY) / this.scale
        };
    }

    worldToScreen(x, y) {
        return {
            x: this.offsetX + x * this.scale,
            y: this.offsetY + y * this.scale
        };
    }

    zoomAt(screenX, screenY, factor, canvas) {
        const world = this.screenToWorld(screenX, screenY);
        this.zoom = Math.max(0.2, Math.min(this.zoom * factor, 8));
        this.updateBaseScale(canvas);
        this.offsetX = screenX - world.x * this.scale;
        this.offsetY = screenY - world.y * this.scale;
    }

    pan(deltaX, deltaY) {
        this.offsetX += deltaX;
        this.offsetY += deltaY;
    }

    resizeCanvas(canvas) {
        if (!canvas || !this.image.complete) {
            return;
        }
        this.updateBaseScale(canvas);
    }

    resetPosition(canvas) {
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = (canvas.height - this.image.height * this.scale) / 2;
    }
}
