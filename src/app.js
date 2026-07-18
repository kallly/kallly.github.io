// Point d'entrée de l'application.
// Ce fichier relie la logique métier, l'interface et le rendu.
import { loadData } from "./service/dataService.js";
import { TroopModel } from "./model/troopModel.js";
import { MapModel } from "./model/mapModel.js";
import { PlacementModel } from "./model/placementModel.js";
import { PolygonModel } from "./model/polygonModel.js";
import { SidebarView } from "./view/sidebarView.js";
import { CanvasRenderer } from "./view/canvasRenderer.js";
import { InputController } from "./controller/inputController.js";
import { UIController, playerFilterFromParam } from "./controller/uiController.js";
import { CollabController } from "./controller/collabController.js";
import { HistoryController } from "./controller/historyController.js";
import { clearStorage } from "./service/saveService.js";
import { initCollab } from "./service/collabService.js";

// Le panneau de placement flottant peut être masqué via sa croix ; un clic sur le
// canvas le fait réapparaître. Comportement purement visuel, indépendant du reste de l'UI.
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

// Panneau d'aide (contrôles/astuces) : purement manuel, contrairement au panneau de
// placement il ne doit pas réapparaître au clic sur le canvas.
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

async function init() {
    // Sélection des éléments du DOM nécessaires à l'application.
    const canvas = document.getElementById("gameCanvas");
    initPlacementPanelToggle(canvas);
    initHelpPanelToggle();
    const elements = {
        troopList: document.getElementById("troopList"),
        levelSelect: document.getElementById("level"),
        selectedTroopText: document.getElementById("selectedTroop"),
        selectedRangeText: document.getElementById("selectedRange"),
        jsonArea: document.getElementById("jsonArea"),
        troopSearch: document.getElementById("troopSearch"),
        troopColor: document.getElementById("troopColor"),
        playerSelect: document.getElementById("playerSelect"),
        mapSelect: document.getElementById("mapSelect"),
        playerFilterSelect: document.getElementById("playerFilterSelect"),
        zoneColor: document.getElementById("zoneColor"),
        drawZone: document.getElementById("drawZone"),
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
    };

    // État partagé entre les composants.
    const state = {
        selectedTroop: null,
        selectedLevel: 0,
        selectedColor: "#FFD54A",
        showRanges: false,
        showNames: false,
        showLevels: false,
        selectedPlayer: "player1",
        // Filtre d'affichage uniquement (n'affecte jamais les données) : "all" ou "player1/2/3".
        // Les troupes des autres joueurs restent en mémoire mais sont dessinées grisées.
        playerFilter: "all",
        playerColors: {
            player1: "#FFD54A",
            player2: "#4A90E2",
            player3: "#E24A4A"
        },
        // Surcharges de couleur par troupe, par joueur : playerTroopColors[player][troopName].
        // playerColors sert de couleur par défaut tant qu'aucune surcharge n'existe pour ce couple.
        playerTroopColors: {},
        pointerX: 0,
        pointerY: 0,
        isPlacementValid: false,
        previewRange: 0,
        previewCollision: 0,
        // Dessin de zones polygonales : purement local pour l'instant (non synchronisé en collab).
        isDrawingPolygon: false,
        polygonDraftPoints: [],
        zoneColor: "#5b8cff"
    };

    // Modèles métiers.
    const troopModel = new TroopModel();
    const mapModel = new MapModel();
    const placementModel = new PlacementModel();
    const polygonModel = new PolygonModel();

    // Historique local (annulation des dernières actions), indépendant de la collaboration.
    const historyController = new HistoryController({ state, placementModel, polygonModel });

    // Vue latérale et rendu de canvas.
    const sidebarView = new SidebarView({
        ...elements,
        canvas
    }, troopModel, state);
    const canvasRenderer = new CanvasRenderer(canvas, mapModel, placementModel, polygonModel, state);

    // Contrôleurs pour la logique UI et les interactions.
    const uiController = new UIController({
        state,
        mapModel,
        troopModel,
        placementModel,
        polygonModel,
        sidebarView,
        canvas,
        canvasRenderer,
        historyController
    });

    // Collaboration en temps réel : indisponible si Firebase n'est pas configuré,
    // ce qui ne doit pas empêcher le reste de l'application de démarrer. Lancée sans attendre
    // pour ne pas bloquer le chargement des données (troops/maps) derrière l'auth Firebase :
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
        troopModel,
        state,
        callbacks: {
            onPreviewUpdate: () => uiController.updateSelectedTroopPanel(),
            onSelectionChanged: (selected) => {
                if (selected) {
                    state.selectedTroop = null;
                    sidebarView.setSelectedLevel(selected.level);
                    sidebarView.setSelectedPlayer(selected.player || state.selectedPlayer);
                    sidebarView.updateSelectedTroopPanel({ troopName: selected.troop, range: selected.range });
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
            onSaveRequested: () => uiController.handleSave(),
            onLoadRequested: () => uiController.handleLoad(),
            onUndoRequested: () => uiController.handleUndo()
        }
    });

    // Redimensionnement lorsque la fenêtre change de taille.
    window.addEventListener("resize", () => {
        canvasRenderer.resize();
    });

    // Chargement des données de configuration.
    const data = await loadData();
    troopModel.setTroopData(data.troops);
    mapModel.setMaps(data.maps);

    sidebarView.buildMapMenu(Object.keys(data.maps));
    sidebarView.buildTroopMenu();

    // Restauration automatique de la dernière progression sauvegardée.
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

    // Filtre joueur pré-sélectionné via ?p= (0=All, 1..3=playerN) : applicable quelle que soit
    // la façon dont la carte a été chargée ci-dessus (data/map/autosave/défaut).
    if (searchParams.has("p")) {
        state.playerFilter = playerFilterFromParam(searchParams.get("p"));
        if (elements.playerFilterSelect) {
            elements.playerFilterSelect.value = state.playerFilter;
        }
    }

    // Simple garde avant de considérer l'appli prête : ne bloque plus le rendu de la carte,
    // déjà affichée à ce stade quel que soit l'état de la collaboration.
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
