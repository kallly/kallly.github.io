import { createSaveData, createCompactSaveData, parseSaveData, saveToStorage, loadFromStorage, loadFromLZString, encodeBase64, saveDisplaySettings } from "../service/saveService.js";
import LZString from "../util/lz-string.js";
import { isCircleInPolygon } from "../util/geometry.js";
import { findBestPositionInPolygon } from "../util/placementOptimizer.js";
import { evaluateWaveDamage, loadAnalysisData } from "../service/analysisService.js";

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
    constructor({ state, mapModel, troopModel, placementModel, polygonModel, textLabelModel, pathModel, sidebarView, canvas, canvasRenderer, collabController = null, historyController = null }) {
        this.state = state;
        this.mapModel = mapModel;
        this.troopModel = troopModel;
        this.placementModel = placementModel;
        this.polygonModel = polygonModel;
        this.textLabelModel = textLabelModel;
        this.pathModel = pathModel;
        this.sidebarView = sidebarView;
        this.canvas = canvas;
        this.canvasRenderer = canvasRenderer;
        this.collabController = collabController;
        this.historyController = historyController;
        this.analysisData = null;
        // Mode d'affichage du panneau d'analyse : "single" (une vague choisie dans waveSelect) ou
        // "scan" (résultat du bouton ❯❯❯❯). Piloté par handleAnalyzeWave/handleScanWaves eux-mêmes
        // (chacun se marque comme mode courant) et lu par handlePlacementChangeForAnalysis pour
        // savoir lequel des deux relancer après une modification de troupe.
        this.analysisMode = "single";
        this.attachViewCallbacks();
        this.canvasRenderer.setRenderCallback(() => this.saveCurrentState());
        this.placementModel.onChange((event) => this.handlePlacementChangeForAnalysis(event));
    }

    // Relance l'analyse automatiquement après un ajout, une suppression ou un changement de level
    // (une mise à jour ne touchant pas "level", ex. couleur/joueur, ne change pas les dégâts et ne
    // justifie pas un recalcul). Reste dans le mode courant : si le dernier affichage était un scan
    // (❯❯❯❯), on relance le scan complet plutôt que de revenir à la vague unique — seul un choix
    // explicite dans waveSelect (handleAnalyzeWave) repasse en mode "single". No-op tant que le
    // panneau d'analyse n'a jamais été ouvert (handleAnalyzeWave/handleScanWaves sortent tôt si
    // analysisData est vide).
    handlePlacementChangeForAnalysis({ type, previous }) {
        const affectsAnalysis = type === "add" || type === "remove" || type === "clear"
            || (type === "update" && previous && "level" in previous);
        if (!affectsAnalysis) {
            return;
        }

        if (this.analysisMode === "scan") {
            this.handleScanWaves();
        } else {
            this.handleAnalyzeWave(this.sidebarView.getSelectedWave());
        }
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
        this.sidebarView.on("onToggleDrawZone", () => this.handleToggleDrawZone());
        this.sidebarView.on("onZoneColorChange", (color) => this.handleZoneColorChange(color));
        this.sidebarView.on("onToggleAddText", () => this.handleToggleAddText());
        this.sidebarView.on("onTogglePathTrace", () => this.handleTogglePathTrace());
        this.sidebarView.on("onShowPathJson", () => this.handleShowPathJson());
        this.sidebarView.on("onApplyPathJson", () => this.handleApplyPathJson());
        this.sidebarView.on("onClearPath", () => this.handleClearPath());
        this.sidebarView.on("onTogglePathCoverageSetting", () => this.handleTogglePathCoverageSetting());
        this.sidebarView.on("onToggleAllPathCoverageSetting", () => this.handleToggleAllPathCoverageSetting());
        this.sidebarView.on("onOptimizePlacement", () => this.handleOptimizePlacement());
        this.sidebarView.on("onOpenAnalysis", () => this.handleOpenAnalysis());
        this.sidebarView.on("onAnalyzeWave", (wave) => this.handleAnalyzeWave(wave));
        this.sidebarView.on("onScanWaves", () => this.handleScanWaves());
    }

    // Sélection d'une troupe depuis la liste.
    handleTroopSelected(troopName) {
        this.state.selectedTroop = troopName;
        this.sidebarView.setLevelOptions(this.troopModel.getMaxLevel(troopName));
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
        this.persistAndSyncDisplaySettings();
    }
    // Bascule l'affichage des noms.
    handleToggleName() {
        this.state.showNames = !this.state.showNames;
        this.persistAndSyncDisplaySettings();
    }
    // Bascule l'affichage des levels.
    handleToggleLevel() {
        this.state.showLevels = !this.state.showLevels;
        this.persistAndSyncDisplaySettings();
    }

    // Bascule l'affichage de la ligne "Path in Range" (niveau actif) dans placementPanel.
    handleTogglePathCoverageSetting() {
        this.state.showPathCoverage = !this.state.showPathCoverage;
        this.persistAndSyncDisplaySettings();
        this.updateSelectedTroopPanel();
    }

    // Bascule l'affichage du détail par niveau de la couverture de chemin dans placementPanel.
    handleToggleAllPathCoverageSetting() {
        this.state.showAllPathCoverage = !this.state.showAllPathCoverage;
        this.persistAndSyncDisplaySettings();
        this.updateSelectedTroopPanel();
    }

    // Sauvegarde les 5 réglages d'affichage (checkboxes du panneau ⚙️) dans localStorage et
    // resynchronise leur état visuel (checkboxes + boutons actifs de la toolbar).
    persistAndSyncDisplaySettings() {
        saveDisplaySettings({
            showRanges: this.state.showRanges,
            showNames: this.state.showNames,
            showLevels: this.state.showLevels,
            showPathCoverage: this.state.showPathCoverage,
            showAllPathCoverage: this.state.showAllPathCoverage
        });
        this.sidebarView.syncDisplaySettings(this.state);
    }

    // Annule la dernière action locale (placement, suppression, modification ou vidage).
    handleUndo() {
        if (!this.historyController?.undo()) {
            return;
        }
        this.updateSelectedTroopPanel();
    }

    // Supprime la troupe sélectionnée, sinon le texte sélectionné, sinon la zone sélectionnée.
    handleDeleteSelected() {
        const selected = this.placementModel.getSelected();
        if (selected) {
            this.placementModel.remove(selected);
            this.placementModel.select(null);
            this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
            return;
        }

        const selectedLabel = this.textLabelModel.getSelected();
        if (selectedLabel) {
            this.textLabelModel.remove(selectedLabel);
            this.textLabelModel.select(null);
            return;
        }

        const selectedPolygon = this.polygonModel.getSelected();
        if (selectedPolygon) {
            this.polygonModel.remove(selectedPolygon);
            this.polygonModel.select(null);
        }
    }

    // Vide la carte de toutes les troupes, zones et textes.
    handleClearMap() {
        this.placementModel.clear();
        this.polygonModel.clear();
        this.textLabelModel.clear();
        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
    }

    // Désélectionne tout et quitte les modes dessin de zone / placement de texte en cours,
    // pour garder ces trois modes mutuellement exclusifs.
    resetDrawingModes() {
        this.state.isDrawingPolygon = false;
        this.state.polygonDraftPoints = [];
        this.state.isPlacingText = false;
        this.state.isTracingPath = false;
        this.state.pathDraftPoints = [];
        this.state.selectedTroop = null;
        this.placementModel.select(null);
        this.polygonModel.select(null);
        this.textLabelModel.select(null);
        this.pathModel.select(null);
        this.sidebarView.updateTroopButtons();
        this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
        this.sidebarView.setDrawZoneActive(false);
        this.sidebarView.setAddTextActive(false);
        this.sidebarView.setPathTraceActive(false);
    }

    // Bascule le mode dessin de zone ; désélectionne tout et quitte les autres modes en l'activant.
    handleToggleDrawZone() {
        const activate = !this.state.isDrawingPolygon;
        this.resetDrawingModes();
        this.state.isDrawingPolygon = activate;
        this.sidebarView.setDrawZoneActive(activate);
    }

    // Bascule le mode "placer un texte" ; désélectionne tout et quitte les autres modes en l'activant.
    handleToggleAddText() {
        const activate = !this.state.isPlacingText;
        this.resetDrawingModes();
        this.state.isPlacingText = activate;
        this.sidebarView.setAddTextActive(activate);
    }

    // Bascule le mode "tracer le chemin" (admin) ; désélectionne tout et quitte les autres modes en l'activant.
    handleTogglePathTrace() {
        const activate = !this.state.isTracingPath;
        this.resetDrawingModes();
        this.state.isTracingPath = activate;
        this.sidebarView.setPathTraceActive(activate);
    }

    // Couleur de la prochaine zone dessinée, ou de la zone actuellement sélectionnée.
    handleZoneColorChange(color) {
        this.state.zoneColor = color;
        const selected = this.polygonModel.getSelected();
        if (selected) {
            this.polygonModel.updatePolygon(selected, { color });
        }
    }

    // Télécharge le plan actuel en PNG.
    handleExportPng() {
        const mapPart = (this.state.currentMap || "map").trim().toLowerCase().replace(/\s+/g, "-");
        this.canvasRenderer.exportPng(`tds-mapper-${mapPart}.png`);
    }

    saveCurrentState() {
        saveToStorage(createSaveData(this.placementModel.placedTroops, this.state.currentMap, this.polygonModel.polygons, this.textLabelModel.labels));
    }

    handleShareUrl() {
        const payload = createSaveData(this.placementModel.placedTroops, this.state.currentMap, this.polygonModel.polygons, this.textLabelModel.labels);
        const compactPayload = createCompactSaveData(this.placementModel.placedTroops, this.state.currentMap, this.polygonModel.polygons, this.textLabelModel.labels);
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
        const payload = createSaveData(this.placementModel.placedTroops, this.state.currentMap, this.polygonModel.polygons, this.textLabelModel.labels);
        this.sidebarView.setJsonArea(JSON.stringify(payload, null, 4));
    }

    // Charge un état depuis le textarea JSON.
    handleLoad() {
        try {
            const parsed = parseSaveData(this.sidebarView.getJsonArea());
            this.placementModel.clear();
            this.polygonModel.clear();
            this.textLabelModel.clear();

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

            for (const zoneData of parsed.zones || []) {
                this.polygonModel.add({ color: zoneData.color, points: zoneData.points });
            }

            for (const labelData of parsed.labels || []) {
                this.textLabelModel.add({ text: labelData.text, x: labelData.x, y: labelData.y });
            }

            this.state.currentMap = parsed.mapName || this.state.currentMap;
            alert("Map loaded.");
        }
        catch (error) {
            alert("Invalid JSON.");
            console.error(error);
        }
    }

    // Affiche le(s) chemin(s) actuel(s) en JSON dans le textarea dédié — volontairement isolé
    // de createSaveData/handleSave : ce JSON ne fait jamais partie du save/share/autosave.
    handleShowPathJson() {
        const payload = {
            version: 1,
            paths: this.pathModel.paths.map(path => ({
                points: path.points.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) }))
            }))
        };
        this.sidebarView.setPathJsonArea(JSON.stringify(payload, null, 4));
    }

    // Recharge le(s) chemin(s) depuis le textarea JSON dédié (admin) ; accepte un tableau brut
    // ou l'enveloppe { version, paths } produite par handleShowPathJson, pour rester tolérant.
    handleApplyPathJson() {
        try {
            const parsed = JSON.parse(this.sidebarView.getPathJsonArea());
            const paths = Array.isArray(parsed) ? parsed : (parsed.paths || []);
            this.pathModel.clear();

            for (const pathData of paths) {
                if (!Array.isArray(pathData.points) || pathData.points.length < 2) {
                    continue;
                }
                this.pathModel.add({ points: pathData.points });
            }
            alert("Path loaded.");
        }
        catch (error) {
            alert("Invalid path JSON.");
            console.error(error);
        }
    }

    // Vide uniquement le chemin tracé (admin). Ne touche jamais placementModel/polygonModel/
    // textLabelModel ni handleClearMap : le chemin reste isolé du reste du plan par décision de scope.
    handleClearPath() {
        this.pathModel.clear();
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
        this.polygonModel.clear();
        this.textLabelModel.clear();
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

        for (const zoneData of data.zones || []) {
            this.polygonModel.add({ color: zoneData.color, points: zoneData.points });
        }

        for (const labelData of data.labels || []) {
            this.textLabelModel.add({ text: labelData.text, x: labelData.x, y: labelData.y });
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
            this.sidebarView.updateSelectedTroopPanel({
                troopName: selected.troop,
                range: selected.range,
                dps: this.getDps(selected.troop, selected.level),
                ...this.getPathCoverage(selected.x, selected.y, selected.range),
                allPathCoverage: this.getAllPathCoverage(selected.troop, selected.x, selected.y)
            });
            this.sidebarView.setLevelOptions(this.troopModel.getMaxLevel(selected.troop));
            this.sidebarView.setSelectedLevel(selected.level);
            return;
        }

        if (!this.state.selectedTroop) {
            this.sidebarView.updateSelectedTroopPanel({ troopName: null, range: 0 });
            return;
        }

        const range = this.mapModel.rangeMapMult * this.troopModel.getRange(this.state.selectedTroop, this.state.selectedLevel);
        this.sidebarView.updateSelectedTroopPanel({
            troopName: this.state.selectedTroop,
            range,
            dps: this.getDps(this.state.selectedTroop, this.state.selectedLevel),
            ...this.getPathCoverage(this.state.pointerX, this.state.pointerY, range),
            allPathCoverage: this.getAllPathCoverage(this.state.selectedTroop, this.state.pointerX, this.state.pointerY)
        });
    }

    // Retourne les DPS d'une troupe pour un niveau donné (délègue à TroopModel).
    getDps(troopName, level) {
        return this.troopModel.getDps(troopName, level);
    }

    // Longueur du chemin ennemi couverte par un cercle de portée (x, y, radius) et son % du chemin
    // total. La longueur est renvoyée normalisée en studs (divisée par rangeMapMult, la constante de
    // calibration pixels/stud propre à chaque carte) : sans ça le nombre affiché ne serait qu'un
    // comptage de pixels arbitraire, différent d'une carte à l'autre pour la même distance de jeu.
    // Le pourcentage, lui, est un ratio de deux longueurs en pixels donc rangeMapMult s'y annule déjà.
    // Renvoie des valeurs null si la carte actuelle n'a pas de "path" (maps.json) — le panneau
    // affiche alors "-" plutôt qu'un calcul basé sur une longueur totale de 0.
    getPathCoverage(x, y, radius) {
        const totalLength = this.mapModel.getTotalPathLength();
        if (totalLength <= 0) {
            return { pathLength: null, pathPercent: null };
        }
        const coveredLength = this.mapModel.getPathLengthInCircle(x, y, radius);
        return {
            pathLength: coveredLength / this.mapModel.rangeMapMult,
            pathPercent: (coveredLength / totalLength) * 100
        };
    }

    // Détail par niveau (0 à troop.rangeMultiplier.length - 1) de la couverture de chemin en (x, y).
    // Renvoie null si le réglage "Show All Path Coverage Lengths" est désactivé ou si la troupe
    // est inconnue — le panneau masque alors la liste plutôt que d'afficher des lignes vides.
    getAllPathCoverage(troopName, x, y) {
        if (!this.state.showAllPathCoverage) {
            return null;
        }
        const troop = this.troopModel.getTroop(troopName);
        if (!troop) {
            return null;
        }
        const rows = [];
        for (let level = 0; level < troop.rangeMultiplier.length; level++) {
            const range = this.mapModel.rangeMapMult * this.troopModel.getRange(troopName, level);
            rows.push({ level, ...this.getPathCoverage(x, y, range) });
        }
        return rows;
    }

    // Moyenne, sur tous les niveaux de la troupe, de la longueur de chemin couverte en (x, y).
    // Utilisée comme score à maximiser par handleOptimizePlacement (pas d'affichage direct).
    computeAverageCoverage(troopName, x, y) {
        const troop = this.troopModel.getTroop(troopName);
        if (!troop) {
            return 0;
        }
        let total = 0;
        for (let level = 0; level < troop.rangeMultiplier.length; level++) {
            const range = this.mapModel.rangeMapMult * this.troopModel.getRange(troopName, level);
            total += this.getPathCoverage(x, y, range).pathLength ?? 0;
        }
        return total / troop.rangeMultiplier.length;
    }

    // Place automatiquement la troupe armée à la meilleure position (moyenne de couverture de
    // chemin sur tous ses niveaux) dans CHAQUE zone déjà dessinée, sans jamais laisser son cercle
    // de collision dépasser la zone ni chevaucher une troupe déjà posée. Admin uniquement (bouton
    // .admin-only) ; asynchrone et cède la main régulièrement (findBestPositionInPolygon) pour ne
    // jamais geler le navigateur, même sur de grandes zones.
    async handleOptimizePlacement() {
        if (!this.state.selectedTroop) {
            alert("Select a tower first.");
            return;
        }
        if (this.polygonModel.polygons.length === 0) {
            alert("Draw at least one zone first.");
            return;
        }

        const troopName = this.state.selectedTroop;
        const level = this.state.selectedLevel;
        const collisionRadius = this.mapModel.collisionMapMult * this.troopModel.getCollision(troopName);
        const range = this.mapModel.rangeMapMult * this.troopModel.getRange(troopName, level);
        const player = this.state.selectedPlayer;
        const color = this.state.playerTroopColors[player]?.[troopName]
            || this.state.playerColors[player]
            || this.state.selectedColor
            || "#FFD54A";

        this.sidebarView.setOptimizePlacementActive(true);
        let placedCount = 0;
        let skippedCount = 0;

        try {
            for (const polygon of [...this.polygonModel.polygons]) {
                const best = await findBestPositionInPolygon({
                    points: polygon.points,
                    isValid: (x, y) => isCircleInPolygon(x, y, collisionRadius, polygon.points)
                        && this.placementModel.isPositionFree(x, y, collisionRadius),
                    score: (x, y) => this.computeAverageCoverage(troopName, x, y)
                });

                if (!best) {
                    skippedCount++;
                    continue;
                }

                this.placementModel.add({ troop: troopName, level, x: best.x, y: best.y, collision: collisionRadius, range, player, color });
                placedCount++;
            }
        } finally {
            this.sidebarView.setOptimizePlacementActive(false);
        }

        if (skippedCount > 0) {
            alert(`Placed ${placedCount} tower(s). ${skippedCount} zone(s) were too small or fully occupied.`);
        }
    }

    // Charge (une fois, mis en cache) les données de vagues/DPS puis lance l'analyse de la vague
    // actuellement sélectionnée dans le panneau. Chargement paresseux : jamais déclenché avant
    // la première ouverture du panneau d'analyse (admin).
    async handleOpenAnalysis() {
        if (!this.analysisData) {
            this.sidebarView.setAnalysisLoading(true);
            try {
                this.analysisData = await loadAnalysisData();
                this.sidebarView.populateWaveSelect(this.analysisData.waves.map(w => w.wave));
            } catch (error) {
                console.error(error);
                this.sidebarView.setAnalysisError("Unable to load wave/DPS data.");
                return;
            } finally {
                this.sidebarView.setAnalysisLoading(false);
            }
        }
        this.handleAnalyzeWave(this.sidebarView.getSelectedWave());
    }

    // Construit les tours `{dps, level, detections, pathCoverage}` attendues par evaluateWaveDamage,
    // à partir des troupes actuellement posées. Factorisé car utilisé à l'identique par
    // handleAnalyzeWave (une vague) et handleScanWaves (plusieurs vagues d'affilée).
    buildTowersForAnalysis() {
        const totalPathLength = this.mapModel.getTotalPathLength();
        return this.placementModel.placedTroops.map(troop => ({
            dps: this.analysisData.tdsStats[troop.troop]?.levels?.[troop.level]?.DPS ?? 0,
            level: troop.level,
            detections: this.analysisData.tdsStats[troop.troop]?.detections,
            pathCoverage: totalPathLength > 0
                ? this.mapModel.getPathLengthInCircle(troop.x, troop.y, troop.range) / totalPathLength
                : 0
        }));
    }

    // Analyse la vague `waveNumber` : pour chaque tour placée, calcule sa fraction de couverture du
    // chemin (`pathCoverage`), puis évalue la vague ennemi par ennemi avec report du surplus de
    // dégâts sur le suivant (cf. evaluateWaveDamage dans analysisService.js).
    handleAnalyzeWave(waveNumber) {
        if (!this.analysisData) {
            return;
        }
        this.analysisMode = "single";

        const duration = this.mapModel.getPathDuration();
        if (!duration) {
            this.sidebarView.setAnalysisError("This map has no path/duration data.");
            return;
        }

        const wave = this.analysisData.waves.find(w => w.wave === Number(waveNumber));
        if (!wave) {
            this.sidebarView.setAnalysisError("Wave not found.");
            return;
        }

        const towers = this.buildTowersForAnalysis();
        const { groups, clearTime, allKilled, risk, waveTimerSeconds } = evaluateWaveDamage(wave, this.analysisData.enemies, duration, towers);

        this.sidebarView.renderAnalysis({ wave: wave.wave, rows: groups, clearTime, allKilled, risk, waveTimerSeconds });
    }

    // Bouton "❯❯❯❯" : parcourt les vagues à partir de la Wave 1 (ordre croissant) et s'arrête à la
    // première vague au risque HIGH (incluse). Les vagues LOW traversées en chemin ne sont pas
    // affichées (rien à signaler) ; les vagues MEDIUM restent toutes affichées, pour repérer les
    // vagues qui deviennent tendues avant la première vague qui échoue franchement.
    handleScanWaves() {
        if (!this.analysisData) {
            return;
        }
        this.analysisMode = "scan";

        const duration = this.mapModel.getPathDuration();
        if (!duration) {
            this.sidebarView.setAnalysisError("This map has no path/duration data.");
            return;
        }

        const towers = this.buildTowersForAnalysis();
        const sortedWaves = [...this.analysisData.waves].sort((a, b) => a.wave - b.wave);
        const results = [];

        for (const wave of sortedWaves) {
            const evaluation = evaluateWaveDamage(wave, this.analysisData.enemies, duration, towers);
            if (evaluation.risk === "LOW") {
                continue;
            }

            results.push({ wave: wave.wave, ...evaluation });
        }

        this.sidebarView.renderWaveScan(results);
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
