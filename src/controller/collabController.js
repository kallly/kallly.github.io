import * as collabService from "../service/collabService.js";

// Relie le PlacementModel local à collabService : mutations locales -> Firebase,
// événements Firebase -> mutations locales. Ne connaît pas les détails Firebase.
export class CollabController {
    constructor({ state, mapModel, troopModel, placementModel, uiController, sidebarView }) {
        this.state = state;
        this.mapModel = mapModel;
        this.troopModel = troopModel;
        this.placementModel = placementModel;
        this.uiController = uiController;
        this.sidebarView = sidebarView;
        // Empêche les mutations appliquées depuis le réseau de repartir vers le réseau.
        this.isApplyingRemote = false;

        this.placementModel.onChange((event) => this.handleLocalChange(event));
        collabService.onRemoteTroopAdded((id, data) => this.applyRemoteTroop(id, data));
        collabService.onRemoteTroopChanged((id, data) => this.applyRemoteTroop(id, data));
        collabService.onRemoteTroopRemoved((id) => this.applyRemoteRemoval(id));
        collabService.onRemoteMapChanged((mapName) => this.applyRemoteMapChange(mapName));
    }

    // Ne conserve que les champs pertinents pour le réseau (collision/range sont
    // recalculés localement à partir de troop+level, comme le fait déjà uiController).
    extractSyncFields(placement) {
        return {
            troop: placement.troop,
            level: placement.level,
            x: placement.x,
            y: placement.y,
            color: placement.color,
            player: placement.player
        };
    }

    // Mutation locale du plan -> répercutée vers Firebase si une session est active.
    handleLocalChange({ type, placement }) {
        if (this.isApplyingRemote || !collabService.isSessionActive()) {
            return;
        }

        switch (type) {
            case "add":
                collabService.pushTroopAdd(placement.id, this.extractSyncFields(placement));
                break;
            case "update":
                collabService.pushTroopUpdate(placement.id, this.extractSyncFields(placement));
                break;
            case "remove":
                collabService.pushTroopRemove(placement.id);
                break;
            case "clear":
                collabService.pushClearAll();
                break;
        }
    }

    // Applique un ajout/modification distant (idempotent par id).
    applyRemoteTroop(id, data) {
        this.isApplyingRemote = true;
        const collision = this.mapModel.collisionMapMult * this.troopModel.getCollision(data.troop);
        const range = this.mapModel.rangeMapMult * this.troopModel.getRange(data.troop, data.level);
        const existing = this.placementModel.findById(id);

        if (existing) {
            this.placementModel.updatePlacement(existing, { ...data, collision, range });
        } else {
            this.placementModel.add({ id, ...data, collision, range });
        }

        this.uiController.updateSelectedTroopPanel();
        this.isApplyingRemote = false;
    }

    // Applique une suppression distante.
    applyRemoteRemoval(id) {
        const existing = this.placementModel.findById(id);
        if (!existing) {
            return;
        }

        this.isApplyingRemote = true;
        this.placementModel.remove(existing);
        this.uiController.updateSelectedTroopPanel();
        this.isApplyingRemote = false;
    }

    // Applique un changement de carte distant.
    async applyRemoteMapChange(mapName) {
        if (!mapName || mapName === this.state.currentMap) {
            return;
        }

        this.isApplyingRemote = true;
        await this.uiController.handleMapSelect(mapName);
        this.isApplyingRemote = false;
    }

    // Notifié explicitement par UIController.handleMapSelect (changement de carte local).
    notifyMapChanged(mapName) {
        if (this.isApplyingRemote || !collabService.isSessionActive()) {
            return;
        }
        collabService.pushMapChange(mapName);
    }

    // Crée une session à partir de l'état local courant.
    async createSession() {
        const troops = {};
        for (const troop of this.placementModel.placedTroops) {
            troops[troop.id] = this.extractSyncFields(troop);
        }

        const code = await collabService.createSession({
            mapName: this.state.currentMap,
            troops
        });

        this.sidebarView.setCollabStatus(`Session active : ${code}`);
        this.sidebarView.setCollabActive(true);
        return code;
    }

    // Rejoint une session existante ; lève une erreur si le code est introuvable.
    async joinSession(roomCode) {
        const exists = await collabService.sessionExists(roomCode);
        if (!exists) {
            throw new Error("Session introuvable.");
        }

        this.placementModel.clear();
        collabService.joinSession(roomCode);
        this.sidebarView.setCollabStatus(`Session active : ${roomCode}`);
        this.sidebarView.setCollabActive(true);
    }

    // Quitte la session courante et repasse en mode 100% local.
    leaveSession() {
        collabService.leaveSession();
        this.sidebarView.setCollabStatus("Hors ligne");
        this.sidebarView.setCollabActive(false);
    }

    getRoomCode() {
        return collabService.getRoomCode();
    }
}
