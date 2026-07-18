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
        this.elements.deleteSelected.addEventListener("click", () => this.dispatch("onDeleteSelected"));
        this.elements.clearMap.addEventListener("click", () => this.dispatch("onClearMap"));
        this.elements.urlShareMap.addEventListener("click", () => this.dispatch("onUrlShare"));
        this.elements.saveMap.addEventListener("click", () => this.dispatch("onSave"));
        this.elements.loadMap.addEventListener("click", () => this.dispatch("onLoad"));
        this.elements.mapSelect.addEventListener("change", () => this.dispatch("onMapSelect", this.elements.mapSelect.value));
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
    updateSelectedTroopPanel({ troopName, range }) {
        if (!troopName) {
            this.elements.selectedTroopText.textContent = "None";
            this.elements.selectedRangeText.textContent = "-";
            return;
        }

        this.elements.selectedTroopText.textContent = troopName;
        this.elements.selectedRangeText.textContent = range.toFixed(1);
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
}
