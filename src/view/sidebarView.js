// Vue de la barre latérale.
// Ce composant gère l'interface HTML et transmet les actions à l'application.
export class SidebarView {
    constructor(elements, troopModel, state) {
        this.elements = elements;
        this.troopModel = troopModel;
        this.state = state;
        this.callbacks = {};
        this.attachEvents();
    }

    // Attache les événements DOM aux actions du contrôleur.
    attachEvents() {
        this.elements.troopSearch.addEventListener("input", () => this.buildTroopMenu(this.elements.troopSearch.value));
        this.elements.levelSelect.addEventListener("change", () => this.dispatch("onLevelChange", Number(this.elements.levelSelect.value)));
        this.elements.playerSelect.addEventListener("change", () => this.dispatch("onPlayerChange", this.elements.playerSelect.value));
        this.elements.troopColor.addEventListener("input", () => this.dispatch("onColorChange", this.elements.troopColor.value));
        this.elements.toggleRangeButton.addEventListener("click", () => this.dispatch("onToggleRange"));
        this.elements.toggleNameButton.addEventListener("click", () => this.dispatch("onToggleName"));
        this.elements.toggleLevelButton.addEventListener("click", () => this.dispatch("onToggleLevel"));
        this.elements.undoAction.addEventListener("click", () => this.dispatch("onUndo"));
        this.elements.deleteSelected.addEventListener("click", () => this.dispatch("onDeleteSelected"));
        this.elements.clearMap.addEventListener("click", () => this.dispatch("onClearMap"));
        this.elements.exportPng.addEventListener("click", () => this.dispatch("onExportPng"));
        this.elements.urlShareMap.addEventListener("click", () => this.dispatch("onUrlShare"));
        this.elements.saveMap.addEventListener("click", () => this.dispatch("onSave"));
        this.elements.loadMap.addEventListener("click", () => this.dispatch("onLoad"));
        this.elements.mapSelect.addEventListener("change", () => this.dispatch("onMapSelect", this.elements.mapSelect.value));
        this.elements.playerFilterSelect.addEventListener("change", () => this.dispatch("onPlayerFilterChange", this.elements.playerFilterSelect.value));
        this.elements.drawZone.addEventListener("click", () => this.dispatch("onToggleDrawZone"));
        this.elements.zoneColor.addEventListener("input", () => this.dispatch("onZoneColorChange", this.elements.zoneColor.value));
        this.elements.addText.addEventListener("click", () => this.dispatch("onToggleAddText"));
        this.elements.tracePath.addEventListener("click", () => this.dispatch("onTogglePathTrace"));
        this.elements.showPathJson.addEventListener("click", () => this.dispatch("onShowPathJson"));
        this.elements.applyPathJson.addEventListener("click", () => this.dispatch("onApplyPathJson"));
        this.elements.clearPath.addEventListener("click", () => this.dispatch("onClearPath"));
        this.elements.showRangesCheckbox.addEventListener("change", () => this.dispatch("onToggleRange"));
        this.elements.showNamesCheckbox.addEventListener("change", () => this.dispatch("onToggleName"));
        this.elements.showLevelsCheckbox.addEventListener("change", () => this.dispatch("onToggleLevel"));
        this.elements.showPathCoverageCheckbox.addEventListener("change", () => this.dispatch("onTogglePathCoverageSetting"));
        this.elements.showAllPathCoverageCheckbox.addEventListener("change", () => this.dispatch("onToggleAllPathCoverageSetting"));
        this.elements.optimizePlacement.addEventListener("click", () => this.dispatch("onOptimizePlacement"));
        this.elements.resetMapPosition.addEventListener("click", () => this.dispatch("onResetMapPosition"));
        this.elements.collabCreateSession.addEventListener("click", () => this.dispatch("onCreateSession"));
        this.elements.collabJoinSession.addEventListener("click", () => this.dispatch("onJoinSession", this.elements.collabRoomCodeInput.value.trim().toUpperCase()));
        this.elements.collabLeaveSession.addEventListener("click", () => this.dispatch("onLeaveSession"));
    }

    // Enregistre un callback pour une action.
    on(name, callback) {
        this.callbacks[name] = callback;
    }

    // Exécute le callback enregistré pour l'action.
    dispatch(name, value) {
        if (typeof this.callbacks[name] === "function") {
            this.callbacks[name](value);
        }
    }

    // Construit le menu des cartes disponibles.
    buildMapMenu(mapNames = []) {
        this.elements.mapSelect.innerHTML = "";
        for (const mapName of mapNames) {
            const option = document.createElement("option");
            option.value = mapName;
            option.textContent = mapName;
            this.elements.mapSelect.appendChild(option);
        }
    }

    // Construit la liste des troupes filtrée par recherche.
    buildTroopMenu(filter = "") {
        this.elements.troopList.innerHTML = "";
        const troopNames = this.troopModel.getNames(filter);

        for (const troopName of troopNames) {
            const button = document.createElement("button");
            button.className = "troopButton";
            button.textContent = troopName;
            button.addEventListener("click", () => this.dispatch("onTroopSelected", troopName));
            this.elements.troopList.appendChild(button);
        }

        this.updateTroopButtons();
    }

    // Met à jour la classe des boutons de troupe pour la sélection.
    updateTroopButtons() {
        const buttons = this.elements.troopList.querySelectorAll("button");
        buttons.forEach(button => {
            if (button.textContent === this.state.selectedTroop) {
                button.classList.add("selected");
            } else {
                button.classList.remove("selected");
            }
        });
    }

    // Met à jour le panneau d'information sur la troupe sélectionnée.
    updateSelectedTroopPanel({ troopName, range, pathLength = null, pathPercent = null, allPathCoverage = null }) {
        this.elements.pathCoverageRow.style.display = this.state.showPathCoverage ? "" : "none";

        if (!troopName) {
            this.elements.selectedTroopText.textContent = "None";
            this.elements.selectedRangeText.textContent = "-";
            this.elements.selectedPathCoverage.textContent = "-";
            this.renderAllPathCoverage(null);
            return;
        }

        this.elements.selectedTroopText.textContent = troopName;
        this.elements.selectedRangeText.textContent = range.toFixed(1);
        this.elements.selectedPathCoverage.textContent = pathLength === null
            ? "-"
            : `${pathLength.toFixed(1)} (${pathPercent.toFixed(1)}%)`;
        this.renderAllPathCoverage(allPathCoverage);
    }

    // Construit la liste "L0/L1/.../Ln" dans #allPathCoverageList, ou la masque/vide si `rows`
    // est null (réglage désactivé, aucune troupe sélectionnée/armée, ou troupe inconnue).
    renderAllPathCoverage(rows) {
        const container = this.elements.allPathCoverageList;
        container.innerHTML = "";
        if (!rows) {
            container.style.display = "none";
            return;
        }

        container.style.display = "";
        for (const row of rows) {
            const value = row.pathLength === null ? "-" : `${row.pathLength.toFixed(1)} (${row.pathPercent.toFixed(1)}%)`;
            const rowEl = document.createElement("div");
            rowEl.className = "selected-info__row";
            rowEl.innerHTML = `<span class="selected-info__label">L${row.level}</span><span class="selected-info__value">${value}</span>`;
            container.appendChild(rowEl);
        }
    }

    // Synchronise les 5 checkboxes du panneau ⚙️ (et l'état visuel "actif" des boutons de la
    // toolbar existants) avec l'état courant — appelé au démarrage et après chaque bascule,
    // que celle-ci vienne d'une checkbox ou du bouton toolbar correspondant.
    syncDisplaySettings(state) {
        this.elements.showRangesCheckbox.checked = state.showRanges;
        this.elements.showNamesCheckbox.checked = state.showNames;
        this.elements.showLevelsCheckbox.checked = state.showLevels;
        this.elements.showPathCoverageCheckbox.checked = state.showPathCoverage;
        this.elements.showAllPathCoverageCheckbox.checked = state.showAllPathCoverage;

        this.elements.toggleRangeButton.classList.toggle("active", state.showRanges);
        this.elements.toggleNameButton.classList.toggle("active", state.showNames);
        this.elements.toggleLevelButton.classList.toggle("active", state.showLevels);
    }

    // Définition du niveau sélectionné.
    setSelectedLevel(level) {
        this.elements.levelSelect.value = String(level);
    }

    // Définition du joueur sélectionné.
    setSelectedPlayer(player) {
        this.elements.playerSelect.value = player;
    }

    // Définition de la couleur sélectionnée.
    setSelectedColor(color) {
        this.elements.troopColor.value = color;
    }

    setJsonArea(text) {
        this.elements.jsonArea.value = text;
    }

    // Met à jour le texte de statut de la session collaborative.
    setCollabStatus(text) {
        this.elements.collabStatus.textContent = text;
    }

    // Bascule l'affichage des contrôles selon qu'une session est active ou non.
    setCollabActive(active) {
        this.elements.collabLeaveSession.style.display = active ? "" : "none";
        this.elements.collabCreateSession.style.display = active ? "none" : "";
        this.elements.collabJoinSession.style.display = active ? "none" : "";
        this.elements.collabRoomCodeInput.style.display = active ? "none" : "";
    }

    getJsonArea() {
        return this.elements.jsonArea.value;
    }

    // Bascule l'état visuel "actif" du bouton de dessin de zone.
    setDrawZoneActive(active) {
        this.elements.drawZone.classList.toggle("active", active);
    }

    // Définit la couleur affichée dans le sélecteur de couleur de zone.
    setZoneColor(color) {
        this.elements.zoneColor.value = color;
    }

    // Bascule l'état visuel "actif" du bouton de placement de texte.
    setAddTextActive(active) {
        this.elements.addText.classList.toggle("active", active);
    }

    // Bascule l'état visuel "actif" du bouton de tracé de chemin.
    setPathTraceActive(active) {
        this.elements.tracePath.classList.toggle("active", active);
    }

    setPathJsonArea(text) {
        this.elements.pathJsonArea.value = text;
    }

    getPathJsonArea() {
        return this.elements.pathJsonArea.value;
    }

    // Bascule l'état "en cours" (bouton désactivé + icône qui tourne) de l'auto-placement optimal.
    setOptimizePlacementActive(active) {
        this.elements.optimizePlacement.disabled = active;
        this.elements.optimizePlacement.classList.toggle("spinning", active);
    }
}
