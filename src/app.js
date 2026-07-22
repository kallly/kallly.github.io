// Point d'entrée : relie logique métier, interface et rendu.
import { loadData } from "./service/dataService.js";
import { TroopModel } from "./model/troopModel.js";
import { MapModel } from "./model/mapModel.js";
import { PlacementModel } from "./model/placementModel.js";
import { PolygonModel } from "./model/polygonModel.js";
import { TextLabelModel } from "./model/textLabelModel.js";
import { PathModel } from "./model/pathModel.js";
import { SidebarView } from "./view/sidebarView.js";
import { CanvasRenderer } from "./view/canvasRenderer.js";
import { InputController } from "./controller/inputController.js";
import { UIController, playerFilterFromParam } from "./controller/uiController.js";
import { CollabController } from "./controller/collabController.js";
import { HistoryController } from "./controller/historyController.js";
import { clearStorage, saveDisplaySettings, loadDisplaySettings } from "./service/saveService.js";
import { initCollab } from "./service/collabService.js";

// Masquable via sa croix ; un clic sur le canvas le fait réapparaître.
function initPlacementPanelToggle(canvas) {
    const panel = document.getElementById("placementPanel");
    const closeButton = document.getElementById("placementPanelClose");
    if (!panel || !closeButton) {
        return;
    }

    closeButton.addEventListener("click", () => panel.classList.add("panel-hidden"));
    canvas.addEventListener("mousedown", () => panel.classList.remove("panel-hidden"));
    canvas.addEventListener("touchstart", () => panel.classList.remove("panel-hidden"), { passive: true });
}

// Contrairement au panneau de placement, ne réapparaît pas au clic sur le canvas.
function initHelpPanelToggle() {
    const panel = document.getElementById("helpPanel");
    const openButton = document.getElementById("helpButton");
    const closeButton = document.getElementById("helpPanelClose");
    if (!panel || !openButton || !closeButton) {
        return;
    }

    openButton.addEventListener("click", () => panel.classList.toggle("panel-hidden"));
    closeButton.addEventListener("click", () => panel.classList.add("panel-hidden"));
}

// Réglages d'affichage de placementPanel (⚙️), même comportement que helpPanel.
function initPlacementSettingsToggle() {
    const panel = document.getElementById("placementSettingsPanel");
    const openButton = document.getElementById("placementSettingsButton");
    const closeButton = document.getElementById("placementSettingsPanelClose");
    if (!panel || !openButton || !closeButton) {
        return;
    }

    openButton.addEventListener("click", () => panel.classList.toggle("panel-hidden"));
    closeButton.addEventListener("click", () => panel.classList.add("panel-hidden"));
}

// Panneau d'analyse de vague (admin, 📊) ; chargement des données géré séparément par UIController.
function initAnalysisPanelToggle() {
    const panel = document.getElementById("analysisPanel");
    const openButton = document.getElementById("openAnalysis");
    const closeButton = document.getElementById("analysisPanelClose");
    if (!panel || !openButton || !closeButton) {
        return;
    }

    openButton.addEventListener("click", () => panel.classList.toggle("panel-hidden"));
    closeButton.addEventListener("click", () => panel.classList.add("panel-hidden"));
}

// Overlay positionné au clic plutôt que window.prompt(), indisponible en webview/iframe.
function initTextLabelInput({ mapModel, textLabelModel, canvas }) {
    const input = document.getElementById("textLabelInput");
    if (!input) {
        return { requestTextAt: () => {} };
    }

    let pending = null;
    let cancelled = false;

    function hide() {
        input.style.display = "none";
        input.value = "";
        pending = null;
    }

    function commit() {
        const target = pending;
        if (!cancelled && target) {
            const text = input.value.trim().slice(0, 20);
            if (text) {
                textLabelModel.add({ text, x: target.x, y: target.y });
            }
        }
        hide();
    }

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            input.blur();
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancelled = true;
            input.blur();
        }
    });

    input.addEventListener("blur", () => {
        commit();
        cancelled = false;
    });

    return {
        requestTextAt(worldX, worldY) {
            pending = { x: worldX, y: worldY };
            cancelled = false;
            const screen = mapModel.worldToScreen(worldX, worldY);
            input.style.left = `${canvas.offsetLeft + screen.x}px`;
            input.style.top = `${canvas.offsetTop + screen.y}px`;
            input.style.display = "block";
            input.value = "";
            input.focus();
        }
    };
}

const ADMIN_STORAGE_KEY = "tds-mapper-admin";

// Toujours actif sur admin.html ; sur index.html activable via ?admin=1/0, persisté en localStorage.
// Bascule purement l'affichage (.admin-only), ne restreint aucune donnée/logique modèle.
function resolveAdminMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("admin")) {
        const enabled = params.get("admin") !== "0";
        try {
            localStorage.setItem(ADMIN_STORAGE_KEY, enabled ? "1" : "0");
        } catch (error) {
            console.warn("Unable to persist admin mode:", error);
        }
    }

    const hardcoded = document.body.classList.contains("admin-mode");
    let stored = false;
    try {
        stored = localStorage.getItem(ADMIN_STORAGE_KEY) === "1";
    } catch (error) {
        stored = false;
    }

    const isAdmin = hardcoded || stored;
    document.body.classList.toggle("admin-mode", isAdmin);
    return isAdmin;
}

async function init() {
    const isAdmin = resolveAdminMode();

    const canvas = document.getElementById("gameCanvas");
    initPlacementPanelToggle(canvas);
    initHelpPanelToggle();
    initPlacementSettingsToggle();
    initAnalysisPanelToggle();

    const displaySettings = loadDisplaySettings() || {};

    const elements = {
        troopList: document.getElementById("troopList"),
        levelSelect: document.getElementById("level"),
        selectedTroopText: document.getElementById("selectedTroop"),
        selectedRangeText: document.getElementById("selectedRange"),
        selectedDpsText: document.getElementById("selectedDps"),
        selectedPathCoverage: document.getElementById("selectedPathCoverage"),
        jsonArea: document.getElementById("jsonArea"),
        troopSearch: document.getElementById("troopSearch"),
        troopColor: document.getElementById("troopColor"),
        playerSelect: document.getElementById("playerSelect"),
        mapSelect: document.getElementById("mapSelect"),
        playerFilterSelect: document.getElementById("playerFilterSelect"),
        zoneColor: document.getElementById("zoneColor"),
        drawZone: document.getElementById("drawZone"),
        addText: document.getElementById("addText"),
        toggleRangeButton: document.getElementById("toggleRange"),
        toggleNameButton: document.getElementById("toggleName"),
        toggleLevelButton: document.getElementById("toggleLevel"),
        undoAction: document.getElementById("undoAction"),
        deleteSelected: document.getElementById("deleteSelected"),
        clearMap: document.getElementById("clearMap"),
        exportPng: document.getElementById("exportPng"),
        urlShareMap: document.getElementById("urlShareMap"),
        saveMap: document.getElementById("saveMap"),
        loadMap: document.getElementById("loadMap"),
        resetMapPosition: document.getElementById("resetMapPosition"),
        collabStatus: document.getElementById("collabStatus"),
        collabCreateSession: document.getElementById("collabCreateSession"),
        collabRoomCodeInput: document.getElementById("collabRoomCodeInput"),
        collabJoinSession: document.getElementById("collabJoinSession"),
        collabLeaveSession: document.getElementById("collabLeaveSession"),
        tracePath: document.getElementById("tracePath"),
        optimizePlacement: document.getElementById("optimizePlacement"),
        openAnalysis: document.getElementById("openAnalysis"),
        waveSelect: document.getElementById("waveSelect"),
        scanWaves: document.getElementById("scanWaves"),
        analysisStatus: document.getElementById("analysisStatus"),
        analysisResults: document.getElementById("analysisResults"),
        showPathJson: document.getElementById("showPathJson"),
        applyPathJson: document.getElementById("applyPathJson"),
        clearPath: document.getElementById("clearPath"),
        pathJsonArea: document.getElementById("pathJsonArea"),
        pathCoverageRow: document.getElementById("pathCoverageRow"),
        allPathCoverageList: document.getElementById("allPathCoverageList"),
        showRangesCheckbox: document.getElementById("showRangesCheckbox"),
        showNamesCheckbox: document.getElementById("showNamesCheckbox"),
        showLevelsCheckbox: document.getElementById("showLevelsCheckbox"),
        showPathCoverageCheckbox: document.getElementById("showPathCoverageCheckbox"),
        showAllPathCoverageCheckbox: document.getElementById("showAllPathCoverageCheckbox"),
    };

    const state = {
        isAdmin,
        selectedTroop: null,
        selectedLevel: 0,
        selectedColor: "#FFD54A",
        showRanges: displaySettings.showRanges ?? false,
        showNames: displaySettings.showNames ?? false,
        showLevels: displaySettings.showLevels ?? false,
        showPathCoverage: displaySettings.showPathCoverage ?? true,
        showAllPathCoverage: displaySettings.showAllPathCoverage ?? false,
        selectedPlayer: "player1",
        // Filtre d'affichage uniquement, n'affecte jamais les données.
        playerFilter: "all",
        playerColors: {
            player1: "#FFD54A",
            player2: "#4A90E2",
            player3: "#E24A4A"
        },
        // Surcharges par troupe/joueur : playerTroopColors[player][troopName]. playerColors = défaut.
        playerTroopColors: {},
        pointerX: 0,
        pointerY: 0,
        isPlacementValid: false,
        previewRange: 0,
        previewCollision: 0,
        // Zones/texte/chemin (admin) : purement local, non synchronisé en collab ni sauvegardé.
        isDrawingPolygon: false,
        polygonDraftPoints: [],
        zoneColor: "#5b8cff",
        isPlacingText: false,
        isTracingPath: false,
        pathDraftPoints: []
    };

    const troopModel = new TroopModel();
    const mapModel = new MapModel();
    const placementModel = new PlacementModel();
    const polygonModel = new PolygonModel();
    const textLabelModel = new TextLabelModel();
    const pathModel = new PathModel();

    const historyController = new HistoryController({ state, placementModel, polygonModel, textLabelModel, pathModel });

    const sidebarView = new SidebarView({
        ...elements,
        canvas
    }, troopModel, state);
    sidebarView.syncDisplaySettings(state);
    const canvasRenderer = new CanvasRenderer(canvas, mapModel, placementModel, polygonModel, textLabelModel, pathModel, state);
    const textLabelInputController = initTextLabelInput({ mapModel, textLabelModel, canvas });

    const uiController = new UIController({
        state,
        mapModel,
        troopModel,
        placementModel,
        polygonModel,
        textLabelModel,
        pathModel,
        sidebarView,
        canvas,
        canvasRenderer,
        historyController
    });

    // Lancée sans attendre pour ne pas bloquer le chargement des données derrière l'auth Firebase ;
    // rien n'utilise db/auth avant un clic explicite sur "Create session"/"Join".
    const collabInitPromise = initCollab().catch((error) => {
        console.warn("Real-time collaboration unavailable (missing or invalid Firebase configuration):", error);
    });

    const collabController = new CollabController({
        state,
        mapModel,
        troopModel,
        placementModel,
        uiController,
        sidebarView
    });
    uiController.collabController = collabController;

    sidebarView.on("onCreateSession", async () => {
        try {
            await collabController.createSession();
        } catch (error) {
            alert("Unable to create the session.");
            console.error(error);
        }
    });
    sidebarView.on("onJoinSession", async (roomCode) => {
        if (!roomCode) {
            return;
        }
        try {
            await collabController.joinSession(roomCode);
        } catch (error) {
            alert(error.message || "Unable to join the session.");
            console.error(error);
        }
    });
    sidebarView.on("onLeaveSession", () => collabController.leaveSession());

    const inputController = new InputController({
        canvas,
        mapModel,
        placementModel,
        polygonModel,
        textLabelModel,
        pathModel,
        troopModel,
        state,
        callbacks: {
            onPreviewUpdate: () => uiController.updateSelectedTroopPanel(),
            onSelectionChanged: (selected) => {
                if (selected) {
                    state.selectedTroop = null;
                    sidebarView.setLevelOptions(troopModel.getMaxLevel(selected.troop));
                    sidebarView.setSelectedLevel(selected.level);
                    sidebarView.setSelectedPlayer(selected.player || state.selectedPlayer);
                    sidebarView.updateSelectedTroopPanel({
                        troopName: selected.troop,
                        range: selected.range,
                        dps: uiController.getDps(selected.troop, selected.level),
                        ...uiController.getPathCoverage(selected.x, selected.y, selected.range),
                        allPathCoverage: uiController.getAllPathCoverage(selected.troop, selected.x, selected.y)
                    });
                    sidebarView.setSelectedColor(selected.color || state.playerColors[selected.player] || state.selectedColor);
                } else {
                    uiController.updateSelectedTroopPanel();
                }
            },
            onZoneSelectionChanged: (selected) => {
                if (selected) {
                    sidebarView.setZoneColor(selected.color);
                }
            },
            onZoneFinished: () => sidebarView.setDrawZoneActive(false),
            onZoneCancelled: () => sidebarView.setDrawZoneActive(false),
            onTextPlacementEnded: () => sidebarView.setAddTextActive(false),
            onTextPlacementRequested: (x, y) => textLabelInputController.requestTextAt(x, y),
            onPathFinished: () => sidebarView.setPathTraceActive(false),
            onPathCancelled: () => sidebarView.setPathTraceActive(false),
            onSaveRequested: () => uiController.handleSave(),
            onLoadRequested: () => uiController.handleLoad(),
            onUndoRequested: () => uiController.handleUndo()
        }
    });

    window.addEventListener("resize", () => {
        canvasRenderer.resize();
    });

    const data = await loadData();
    troopModel.setTroopData(data.troops);
    troopModel.setStatsData(data.stats);
    mapModel.setMaps(data.maps);

    sidebarView.buildMapMenu(Object.keys(data.maps));
    sidebarView.buildTroopMenu();

    const defaultMap = Object.keys(data.maps)[0];
    
    const searchParams = new URLSearchParams(window.location.search);
    let restored = null;
    
    if (searchParams.has("data"))
    {
        restored = await uiController.loadLZString(defaultMap, searchParams.get("data"));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    else if (searchParams.has("map") && data.maps[searchParams.get("map")]) {
        const requestedMap = searchParams.get("map");
        await uiController.handleMapSelect(requestedMap);
        if (elements.mapSelect) {
            elements.mapSelect.value = requestedMap;
        }
        restored = true;
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (!restored) {
        restored = await uiController.loadAutoSave(defaultMap);
    }
    if (!restored) {
        await uiController.handleMapSelect(defaultMap);
    }

    // Filtre joueur pré-sélectionné via ?p= (0=All, 1..3=playerN).
    if (searchParams.has("p")) {
        state.playerFilter = playerFilterFromParam(searchParams.get("p"));
        if (elements.playerFilterSelect) {
            elements.playerFilterSelect.value = state.playerFilter;
        }
    }

    await collabInitPromise;

    canvasRenderer.resize();
    canvasRenderer.start();
}

init().catch(error => {
    console.error("Error during initialization:", error);
    clearStorage()
    window.history.replaceState({}, document.title, window.location.pathname);

    init().catch(error => {
        console.error("Error during initialization:", error);
        alert("Unable to start the application. Check the console.");
    });
});
