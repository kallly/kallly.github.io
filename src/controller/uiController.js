import { createSaveData, parseSaveData } from "../service/saveService.js";

// Contrôleur central de l'application.
// Il gère la synchronisation entre l'état, la vue et les modèles.
export class UIController {
    constructor({ state, mapModel, troopModel, placementModel, sidebarView, canvas, canvasRenderer }) {
        this.state = state;
        this.mapModel = mapModel;
        this.troopModel = troopModel;
        this.placementModel = placementModel;
        this.sidebarView = sidebarView;
        this.canvas = canvas;
        this.canvasRenderer = canvasRenderer;
        this.attachViewCallbacks();
    }

    // Enregistre les callbacks provenant de la vue.
    attachViewCallbacks() {
        this.sidebarView.on("onTroopSelected", (troopName) => this.handleTroopSelected(troopName));
        this.sidebarView.on("onLevelChange", (level) => this.handleLevelChange(level));
        this.sidebarView.on("onColorChange", (color) => this.handleColorChange(color));
        this.sidebarView.on("onToggleRange", () => this.handleToggleRange());
        this.sidebarView.on("onDeleteSelected", () => this.handleDeleteSelected());
        this.sidebarView.on("onClearMap", () => this.handleClearMap());
        this.sidebarView.on("onSave", () => this.handleSave());
        this.sidebarView.on("onLoad", () => this.handleLoad());
        this.sidebarView.on("onMapSelect", (mapName) => this.handleMapSelect(mapName));
    }

    // Sélection d'une troupe depuis la liste.
    handleTroopSelected(troopName) {
        this.state.selectedTroop = troopName;
        this.state.selectedLevel = Number(this.sidebarView.elements.levelSelect.value);
        this.placementModel.select(null);
        this.sidebarView.updateTroopButtons();
        this.updateSelectedTroopPanel();
        this.updateSelectedColor();
    }

    // Changement de niveau appliqué à la sélection ou à l'aperçu.
    handleLevelChange(level) {
        this.state.selectedLevel = level;
        const selected = this.placementModel.getSelected();
        if (selected) {
            const range = this.mapModel.rangeMapMult * this.troopModel.getRange(selected.troop, level);
            const collision = this.mapModel.collisionMapMult * this.troopModel.getCollision(selected.troop);
            this.placementModel.updatePlacement(selected, { level, range, collision });
        }
        this.updateSelectedTroopPanel();
    }

    // Changement de couleur appliqué aux troupes de même type.
    handleColorChange(color) {
        const selectedName = this.state.selectedTroop || this.placementModel.getSelected()?.troop;
        if (!selectedName) {
            return;
        }

        this.state.troopColors[selectedName] = color;
        for (const troop of this.placementModel.placedTroops) {
            if (troop.troop === selectedName) {
                troop.color = color;
            }
        }
    }

    // Bascule l'affichage des portées.
    handleToggleRange() {
        this.state.showRanges = !this.state.showRanges;
        this.sidebarView.setToggleRangeButton(this.state.showRanges);
    }

    // Supprime la troupe sélectionnée.
    handleDeleteSelected() {
        const selected = this.placementModel.getSelected();
        if (!selected) {
            return;
        }

        this.placementModel.remove(selected);
        this.placementModel.select(null);
        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
    }

    // Vide la carte de toutes les troupes.
    handleClearMap() {
        this.placementModel.clear();
        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
    }

    // Sauve l'état actuel dans le textarea JSON.
    handleSave() {
        const payload = createSaveData(this.placementModel.placedTroops);
        this.sidebarView.setJsonArea(JSON.stringify(payload, null, 4));
    }

    // Charge un état depuis le textarea JSON.
    handleLoad() {
        try {
            const parsed = parseSaveData(this.sidebarView.getJsonArea());
            this.placementModel.clear();

            if (!Array.isArray(parsed.troops)) {
                return;
            }

            for (const troopData of parsed.troops) {
                if (!this.troopModel.getTroop(troopData.troop)) {
                    continue;
                }

                const collision = this.mapModel.collisionMapMult * this.troopModel.getCollision(troopData.troop);
                const range = this.mapModel.rangeMapMult * this.troopModel.getRange(troopData.troop, troopData.level);
                this.placementModel.add({
                    troop: troopData.troop,
                    level: troopData.level,
                    x: troopData.x,
                    y: troopData.y,
                    collision,
                    range,
                    color: troopData.color || this.state.troopColors[troopData.troop] || "#FFD54A"
                });
            }

            alert("Carte chargée.");
        }
        catch (error) {
            alert("JSON invalide.");
            console.error(error);
        }
    }

    // Change de carte et redimensionne le canvas.
    async handleMapSelect(mapName) {
        await this.mapModel.loadMap(mapName, this.canvas);
        this.canvasRenderer.resize();
        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
    }

    // Met à jour le panneau de la troupe sélectionnée ou l'aperçu.
    updateSelectedTroopPanel() {
        const selected = this.placementModel.getSelected();
        if (selected) {
            this.sidebarView.updateSelectedTroopPanel({ troopName: selected.troop, range: selected.range });
            this.sidebarView.setSelectedLevel(selected.level);
            return;
        }

        if (!this.state.selectedTroop) {
            this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
            return;
        }

        const range = this.mapModel.rangeMapMult * this.troopModel.getRange(this.state.selectedTroop, this.state.selectedLevel);
        this.sidebarView.updateSelectedTroopPanel({ troopName: this.state.selectedTroop, range });
    }

    // Met à jour la couleur sélectionnée de la troupe.
    updateSelectedColor() {
        const selectedName = this.state.selectedTroop || this.placementModel.getSelected()?.troop;
        if (!selectedName) {
            return;
        }
        const color = this.state.troopColors[selectedName] || this.state.selectedColor || "#FFD54A";
        this.sidebarView.setSelectedColor(color);
    }
}
