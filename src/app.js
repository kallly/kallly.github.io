// Point d'entrée de l'application.
// Ce fichier relie la logique métier, l'interface et le rendu.
import { loadData } from "./service/dataService.js";
import { TroopModel } from "./model/troopModel.js";
import { MapModel } from "./model/mapModel.js";
import { PlacementModel } from "./model/placementModel.js";
import { SidebarView } from "./view/sidebarView.js";
import { CanvasRenderer } from "./view/canvasRenderer.js";
import { InputController } from "./controller/inputController.js";
import { UIController } from "./controller/uiController.js";
import { CollabController } from "./controller/collabController.js";
import { clearStorage } from "./service/saveService.js";
import { initCollab } from "./service/collabService.js";

async function init() {
    // Sélection des éléments du DOM nécessaires à l'application.
    const canvas = document.getElementById("gameCanvas");
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
        toggleRangeButton: document.getElementById("toggleRange"),
        toggleNameButton: document.getElementById("toggleName"),
        toggleLevelButton: document.getElementById("toggleLevel"),
        deleteSelected: document.getElementById("deleteSelected"),
        clearMap: document.getElementById("clearMap"),
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
        previewCollision: 0
    };

    // Modèles métiers.
    const troopModel = new TroopModel();
    const mapModel = new MapModel();
    const placementModel = new PlacementModel();

    // Vue latérale et rendu de canvas.
    const sidebarView = new SidebarView({
        ...elements,
        canvas
    }, troopModel, state);
    const canvasRenderer = new CanvasRenderer(canvas, mapModel, placementModel, state);

    // Contrôleurs pour la logique UI et les interactions.
    const uiController = new UIController({
        state,
        mapModel,
        troopModel,
        placementModel,
        sidebarView,
        canvas,
        canvasRenderer
    });

    // Collaboration en temps réel : indisponible si Firebase n'est pas configuré,
    // ce qui ne doit pas empêcher le reste de l'application de démarrer.
    try {
        await initCollab();
    } catch (error) {
        console.warn("Collaboration temps réel indisponible (configuration Firebase manquante ou invalide) :", error);
    }

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
            alert("Impossible de créer la session.");
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
            alert(error.message || "Impossible de rejoindre la session.");
            console.error(error);
        }
    });
    sidebarView.on("onLeaveSession", () => collabController.leaveSession());

    const inputController = new InputController({
        canvas,
        mapModel,
        placementModel,
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
            onSaveRequested: () => uiController.handleSave(),
            onLoadRequested: () => uiController.handleLoad()
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

    canvasRenderer.resize();
    canvasRenderer.start();
}

init().catch(error => {
    console.error("Erreur lors de l'initialisation :", error);
    clearStorage()
    window.history.replaceState({}, document.title, window.location.pathname);

    init().catch(error => {
        console.error("Erreur lors de l'initialisation :", error);
        alert("Impossible de démarrer l'application. Vérifiez la console.");
    });
});
