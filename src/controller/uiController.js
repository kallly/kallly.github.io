import { createSaveData, createCompactSaveData, parseSaveData, saveToStorage, loadFromStorage, loadFromLZString, encodeBase64 } from "../service/saveService.js";
import LZString from "../util/lz-string.js";

// Ordre des index utilisés par le paramètre d'URL "p" (0 = All, 1..3 = playerN).
// Partagé entre la génération des liens (handleShareUrl) et leur lecture (app.js).
export const PLAYER_FILTER_VALUES = ["all", "player1", "player2", "player3"];

export function playerFilterToParam(filter) {
    const index = PLAYER_FILTER_VALUES.indexOf(filter);
    return index === -1 ? 0 : index;
}

export function playerFilterFromParam(param) {
    const index = Number(param);
    return PLAYER_FILTER_VALUES[index] || "all";
}

// Contrôleur central de l'application.
// Il gère la synchronisation entre l'état, la vue et les modèles.
export class UIController {
    constructor({ state, mapModel, troopModel, placementModel, sidebarView, canvas, canvasRenderer, collabController = null, historyController = null }) {
        this.state = state;
        this.mapModel = mapModel;
        this.troopModel = troopModel;
        this.placementModel = placementModel;
        this.sidebarView = sidebarView;
        this.canvas = canvas;
        this.canvasRenderer = canvasRenderer;
        this.collabController = collabController;
        this.historyController = historyController;
        this.attachViewCallbacks();
        this.canvasRenderer.setRenderCallback(() => this.saveCurrentState());
    }

    // Enregistre les callbacks provenant de la vue.
    attachViewCallbacks() {
        this.sidebarView.on("onTroopSelected", (troopName) => this.handleTroopSelected(troopName));
        this.sidebarView.on("onLevelChange", (level) => this.handleLevelChange(level));
        this.sidebarView.on("onPlayerChange", (player) => this.handlePlayerChange(player));
        this.sidebarView.on("onColorChange", (color) => this.handleColorChange(color));
        this.sidebarView.on("onToggleRange", () => this.handleToggleRange());
        this.sidebarView.on("onToggleName", () => this.handleToggleName());
        this.sidebarView.on("onToggleLevel", () => this.handleToggleLevel());
        this.sidebarView.on("onUndo", () => this.handleUndo());
        this.sidebarView.on("onDeleteSelected", () => this.handleDeleteSelected());
        this.sidebarView.on("onClearMap", () => this.handleClearMap());
        this.sidebarView.on("onExportPng", () => this.handleExportPng());
        this.sidebarView.on("onUrlShare", () => this.handleShareUrl());
        this.sidebarView.on("onSave", () => this.handleSave());
        this.sidebarView.on("onLoad", () => this.handleLoad());
        this.sidebarView.on("onMapSelect", (mapName) => this.handleMapSelect(mapName));
        this.sidebarView.on("onPlayerFilterChange", (player) => this.handlePlayerFilterChange(player));
        this.sidebarView.on("onResetMapPosition", () => this.handleResetMapPosition());
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

    // Couleur effective pour un couple joueur/troupe : surcharge par troupe si elle existe, sinon couleur du joueur.
    getColorFor(player, troopName) {
        return this.state.playerTroopColors[player]?.[troopName] || this.state.playerColors[player] || this.state.selectedColor || "#FFD54A";
    }

    // Changement de joueur appliqué à la sélection ou à l'aperçu.
    handlePlayerChange(player) {
        this.state.selectedPlayer = player;
        const selected = this.placementModel.getSelected();
        if (selected) {
            this.placementModel.updatePlacement(selected, { player, color: this.getColorFor(player, selected.troop) });
        }
        this.updateSelectedColor();
    }

    // Changement de couleur appliqué aux troupes du même type ET du même joueur que la sélection.
    handleColorChange(color) {
        const selected = this.placementModel.getSelected();
        const selectedName = this.state.selectedTroop || selected?.troop;
        const player = selected?.player || this.state.selectedPlayer;
        if (!selectedName) {
            return;
        }

        this.state.playerTroopColors[player] = this.state.playerTroopColors[player] || {};
        this.state.playerTroopColors[player][selectedName] = color;

        for (const troop of this.placementModel.placedTroops) {
            if (troop.troop === selectedName && troop.player === player) {
                this.placementModel.updatePlacement(troop, { color });
            }
        }
    }

    // Bascule l'affichage des portées.
    handleToggleRange() {
        this.state.showRanges = !this.state.showRanges;
    }
    // Bascule l'affichage des noms.
    handleToggleName() {
        this.state.showNames = !this.state.showNames;
    }
    // Bascule l'affichage des levels.
    handleToggleLevel() {
        this.state.showLevels = !this.state.showLevels;
    }

    // Annule la dernière action locale (placement, suppression, modification ou vidage).
    handleUndo() {
        if (!this.historyController?.undo()) {
            return;
        }
        this.updateSelectedTroopPanel();
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

    // Télécharge le plan actuel en PNG.
    handleExportPng() {
        const mapPart = (this.state.currentMap || "map").trim().toLowerCase().replace(/\s+/g, "-");
        this.canvasRenderer.exportPng(`tds-mapper-${mapPart}.png`);
    }

    saveCurrentState() {
        saveToStorage(createSaveData(this.placementModel.placedTroops, this.state.currentMap));
    }

    handleShareUrl() {
        const payload = createSaveData(this.placementModel.placedTroops, this.state.currentMap);
        const compactPayload = createCompactSaveData(this.placementModel.placedTroops, this.state.currentMap);
        const data = LZString.compressToEncodedURIComponent(JSON.stringify(compactPayload));
        const playerFilterParam = playerFilterToParam(this.state.playerFilter);
        const url = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(data)}&p=${playerFilterParam}`;
        console.log(data.length)

        navigator.clipboard.writeText(url)
            .then(() => alert("URL copied!"))
            .catch(err => alert("Unable to copy: " + err));
    }
    // Sauve l'état actuel uniquement dans le textarea JSON.
    handleSave() {
        const payload = createSaveData(this.placementModel.placedTroops, this.state.currentMap);
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
                const player = troopData.player || "player1";
                this.placementModel.add({
                    troop: troopData.troop,
                    level: troopData.level,
                    x: troopData.x,
                    y: troopData.y,
                    collision,
                    range,
                    player,
                    color: troopData.color || this.getColorFor(player, troopData.troop)
                });
            }

            this.state.currentMap = parsed.mapName || this.state.currentMap;
            alert("Map loaded.");
        }
        catch (error) {
            alert("Invalid JSON.");
            console.error(error);
        }
    }

    // Change de carte et redimensionne le canvas.
    async handleMapSelect(mapName) {
        this.state.currentMap = mapName;
        await this.mapModel.loadMap(mapName, this.canvas);
        this.canvasRenderer.resize();
        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
        this.collabController?.notifyMapChanged(mapName);
    }

    // Filtre d'affichage par joueur : purement visuel, ne modifie aucune donnée de placement.
    handlePlayerFilterChange(player) {
        this.state.playerFilter = player;
    }

    // Réinitialise la position de la carte.
    handleResetMapPosition() {
        this.mapModel.resetPosition(this.canvas);
    }

    async loadFromData(defaultMapName, data) {
        if (!data || !Array.isArray(data.troops)) {
            return false;
        }

        const mapName = data.mapName || defaultMapName;
        this.state.currentMap = mapName;

        await this.mapModel.loadMap(mapName, this.canvas);
        this.canvasRenderer.resize();
        if (this.sidebarView.elements.mapSelect) {
            this.sidebarView.elements.mapSelect.value = mapName;
        }

        this.placementModel.clear();
        this.sidebarView.setJsonArea(JSON.stringify(data, null, 4));

        for (const troopData of data.troops) {
            if (!this.troopModel.getTroop(troopData.troop)) {
                continue;
            }

            const collision = this.mapModel.collisionMapMult * this.troopModel.getCollision(troopData.troop);
            const range = this.mapModel.rangeMapMult * this.troopModel.getRange(troopData.troop, troopData.level);
            const player = troopData.player || "player1";
            this.placementModel.add({
                troop: troopData.troop,
                level: troopData.level,
                x: troopData.x,
                y: troopData.y,
                collision,
                range,
                player,
                color: troopData.color || this.getColorFor(player, troopData.troop)
            });
        }

        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
        return true
    }
    // Charge le dernier état auto-sauvegardé depuis localStorage.
    async loadAutoSave(defaultMapName) {
        const stored = loadFromStorage();
        return this.loadFromData(defaultMapName, stored);
    }
    // Charge l'état depuis le Base64.
    async loadLZString(defaultMapName, lzString) {
        const data = loadFromLZString(lzString);
        return this.loadFromData(defaultMapName, data);
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

    // Met à jour la couleur affichée pour le couple joueur/troupe actuellement sélectionné.
    updateSelectedColor() {
        const selected = this.placementModel.getSelected();
        const selectedName = this.state.selectedTroop || selected?.troop;
        const player = selected?.player || this.state.selectedPlayer;
        const color = selectedName
            ? this.getColorFor(player, selectedName)
            : (this.state.playerColors[player] || this.state.selectedColor || "#FFD54A");
        this.sidebarView.setSelectedColor(color);
    }
}
