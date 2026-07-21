// Formatte un temps en secondes en "mm:ss", "∞" pour un Wave Timer infini (vagues 43/45).
function formatSeconds(seconds) {
    if (seconds === Infinity) {
        return "∞";
    }
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
}

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
        this.elements.openAnalysis.addEventListener("click", () => this.dispatch("onOpenAnalysis"));
        this.elements.waveSelect.addEventListener("change", () => this.dispatch("onAnalyzeWave", Number(this.elements.waveSelect.value)));
        this.elements.scanWaves.addEventListener("click", () => this.dispatch("onScanWaves"));
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
    updateSelectedTroopPanel({ troopName, range, dps = null, pathLength = null, pathPercent = null, allPathCoverage = null }) {
        this.elements.pathCoverageRow.style.display = this.state.showPathCoverage ? "" : "none";

        if (!troopName) {
            this.elements.selectedTroopText.textContent = "None";
            this.elements.selectedRangeText.textContent = "-";
            this.elements.selectedDpsText.textContent = "-";
            this.elements.selectedPathCoverage.textContent = "-";
            this.renderAllPathCoverage(null);
            return;
        }

        this.elements.selectedTroopText.textContent = troopName;
        this.elements.selectedRangeText.textContent = range.toFixed(1);
        this.elements.selectedDpsText.textContent = dps === null ? "-" : dps.toFixed(1);
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

    // Reconstruit les options 0..maxLevel du select de niveau, en clampant la valeur courante.
    setLevelOptions(maxLevel) {
        const select = this.elements.levelSelect;
        const clamped = Math.min(Number(select.value) || 0, maxLevel);
        select.innerHTML = "";
        for (let level = 0; level <= maxLevel; level++) {
            const option = document.createElement("option");
            option.value = String(level);
            option.textContent = String(level);
            select.appendChild(option);
        }
        select.value = String(clamped);
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

    getSelectedWave() {
        return Number(this.elements.waveSelect.value);
    }

    // Construit la liste des vagues disponibles dans le sélecteur.
    populateWaveSelect(waveNumbers = []) {
        this.elements.waveSelect.innerHTML = "";
        for (const waveNumber of waveNumbers) {
            const option = document.createElement("option");
            option.value = String(waveNumber);
            option.textContent = `Wave ${waveNumber}`;
            this.elements.waveSelect.appendChild(option);
        }
    }

    // Bascule l'état "en cours" (bouton désactivé + icône qui tourne) du chargement des données
    // d'analyse (premier ouverture uniquement, ensuite mises en cache par analysisService).
    setAnalysisLoading(loading) {
        this.elements.openAnalysis.disabled = loading;
        this.elements.openAnalysis.classList.toggle("spinning", loading);
        this.elements.waveSelect.disabled = loading;
    }

    // Affiche un message d'erreur/statut à la place des résultats (données indisponibles,
    // carte sans path.duration, vague introuvable...).
    setAnalysisError(message) {
        this.elements.analysisStatus.textContent = message;
        this.elements.analysisResults.innerHTML = "";
    }

    // Affiche le résultat de l'analyse d'une vague : une ligne par entrée de vague, agrégée depuis
    // evaluateWaveDamage (analysisService.js) — nombre tué/survivant sur le total du groupe, plus
    // une raison de défaite par groupe (pas de troupe adaptée / dégâts insuffisants) et un badge de
    // risque global LOW/MEDIUM/HIGH comparant le temps de clear estimé au Wave Timer officiel.
    renderAnalysis({ wave, rows, clearTime, allKilled, risk, waveTimerSeconds }) {
        const clearText = formatSeconds(clearTime);
        this.elements.analysisStatus.innerHTML = `
            Wave ${wave} — clear ${clearText} / timer ${formatSeconds(waveTimerSeconds)}
            <span class="risk-badge risk-badge--${risk.toLowerCase()}">${risk}</span>
        `;
        this.elements.analysisResults.innerHTML = "";
        this.elements.analysisResults.appendChild(this.buildGroupRows(rows));
    }

    // Construit une ligne par groupe d'ennemis (tué/survécu, raison de défaite) — factorisé car
    // utilisé à la fois par renderAnalysis (une vague) et renderWaveScan (plusieurs vagues).
    buildGroupRows(rows) {
        const fragment = document.createDocumentFragment();

        for (const row of rows) {
            const rowEl = document.createElement("div");
            rowEl.className = "analysis-row";

            if (row.unavailable) {
                rowEl.innerHTML = `<span>${row.enemy} ×${row.count}</span><span>Unknown enemy data</span>`;
                fragment.appendChild(rowEl);
                continue;
            }

            const modifiers = row.modifiers.length > 0 ? ` [${row.modifiers.join(", ")}]` : "";
            const speedText = row.stationary
                ? "Stationary"
                : `${row.approximate ? "~" : ""}${row.speed.toFixed(2)}`;
            const survivedCount = row.survivedCount;
            const verdictClass = survivedCount > 0 ? "analysis-row__verdict--survives" : "analysis-row__verdict--killed";
            const verdictText = survivedCount > 0 ? `${survivedCount}/${row.count} survive` : `${row.count}/${row.count} killed`;
            const defeatLine = row.defeatReason ? `<div class="analysis-row__defeat">${row.defeatReason}</div>` : "";

            rowEl.innerHTML = `
                <div class="analysis-row__main">
                    <span>${row.enemy} ×${row.count}${modifiers}</span>
                    <span>Speed ${speedText} · HP ${row.health ?? "N/A"}</span>
                    <span class="${verdictClass}">${verdictText}</span>
                </div>
                ${defeatLine}
            `;
            fragment.appendChild(rowEl);
        }

        return fragment;
    }

    // Affiche le résultat du bouton "❯❯❯❯" (uiController.handleScanWaves) : une carte par vague
    // retenue (toutes les HIGH et MEDIUM rencontrées) — les vagues
    // LOW traversées ne sont pas affichées.
    renderWaveScan(results) {
        this.elements.analysisResults.innerHTML = "";

        if (results.length === 0) {
            this.elements.analysisStatus.textContent = "Scan complete — every wave clears (no MEDIUM/HIGH risk found).";
            return;
        }

        const last = results[results.length - 1];
        this.elements.analysisStatus.textContent = last.risk === "HIGH"
            ? `Scan stopped at Wave ${last.wave} (first HIGH risk)`
            : `Scan complete — no HIGH risk wave found`;

        for (const entry of results) {
            const block = document.createElement("div");
            block.className = `wave-scan-block wave-scan-block--${entry.risk.toLowerCase()}`;

            const clearText = formatSeconds(entry.clearTime);
            const header = document.createElement("div");
            header.className = "wave-scan-block__header";
            header.innerHTML = `
                <span>Wave ${entry.wave}</span>
                <span>clear ${clearText} / timer ${formatSeconds(entry.waveTimerSeconds)}</span>
                <span class="risk-badge risk-badge--${entry.risk.toLowerCase()}">${entry.risk}</span>
            `;
            block.appendChild(header);

            const rowsWrap = document.createElement("div");
            rowsWrap.className = "wave-scan-block__rows";
            rowsWrap.appendChild(this.buildGroupRows(entry.groups));
            block.appendChild(rowsWrap);

            this.elements.analysisResults.appendChild(block);
        }
    }
}
