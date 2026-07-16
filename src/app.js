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
        mapSelect: document.getElementById("mapSelect"),
        toggleRangeButton: document.getElementById("toggleRange"),
        deleteSelected: document.getElementById("deleteSelected"),
        clearMap: document.getElementById("clearMap"),
        saveMap: document.getElementById("saveMap"),
        loadMap: document.getElementById("loadMap")
    };

    // État partagé entre les composants.
    const state = {
        selectedTroop: null,
        selectedLevel: 0,
        selectedColor: "#FFD54A",
        showRanges: true,
        troopColors: {},
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
                    sidebarView.updateSelectedTroopPanel({ troopName: selected.troop, range: selected.range });
                    sidebarView.setSelectedColor(state.troopColors[selected.troop] || selected.color || state.selectedColor);
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
    sidebarView.setToggleRangeButton(state.showRanges);
    sidebarView.buildTroopMenu();

    // Chargement de la première carte et démarrage du rendu.
    await uiController.handleMapSelect(Object.keys(data.maps)[0]);
    canvasRenderer.resize();
    canvasRenderer.start();
}

init().catch(error => {
    console.error("Erreur lors de l'initialisation :", error);
    alert("Impossible de démarrer l'application. Vérifiez la console.");
});
