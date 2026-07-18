// Modèle métier de la carte.
// Ce module gère le chargement et les conversions écran / monde.
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

    // Définit la liste des cartes disponibles.
    setMaps(maps) {
        this.maps = maps;
    }

    // Charge l'image de la carte sélectionnée.
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

    // Met à jour l'échelle de base et le centrage de l'image sur le canvas.
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

    // Échelle actuelle de dessin, appliquant zoom et ajustement.
    get scale() {
        return this.baseScale * this.zoom;
    }

    get rangeMapMult() {
        return this.currentMap?.rangeMapMult ?? 1;
    }

    get collisionMapMult() {
        return this.currentMap?.collisionMapMult ?? 1;
    }

    // Convertit des coordonnées écran en coordonnées monde.
    screenToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.scale,
            y: (y - this.offsetY) / this.scale
        };
    }

    // Convertit des coordonnées monde en coordonnées écran.
    worldToScreen(x, y) {
        return {
            x: this.offsetX + x * this.scale,
            y: this.offsetY + y * this.scale
        };
    }

    // Zoom autour d'un point écran tout en conservant le positionnement.
    zoomAt(screenX, screenY, factor, canvas) {
        const world = this.screenToWorld(screenX, screenY);
        this.zoom = Math.max(0.2, Math.min(this.zoom * factor, 8));
        this.updateBaseScale(canvas);
        this.offsetX = screenX - world.x * this.scale;
        this.offsetY = screenY - world.y * this.scale;
    }

    // Déplace la vue de la carte.
    pan(deltaX, deltaY) {
        this.offsetX += deltaX;
        this.offsetY += deltaY;
    }

    // Recalcule l'échelle après redimensionnement du canvas.
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
