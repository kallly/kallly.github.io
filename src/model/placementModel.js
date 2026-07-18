// Modèle de placement des troupes.
// Ce module conserve la liste des troupes posées et gère la sélection.
export class PlacementModel {
    constructor() {
        this.placedTroops = [];
        this.selectedPlacedTroop = null;
        this.listeners = [];
    }

    // Enregistre un callback appelé à chaque mutation (add/remove/update/clear).
    // Plusieurs abonnés sont possibles (contrairement au on/dispatch de SidebarView).
    onChange(callback) {
        this.listeners.push(callback);
    }

    // Notifie les abonnés d'une mutation.
    emitChange(type, placement = null) {
        for (const listener of this.listeners) {
            listener({ type, placement });
        }
    }

    // Ajoute une nouvelle troupe posée et la sélectionne.
    // Un id stable est nécessaire pour cibler cette troupe depuis un événement
    // distant (collaboration) ; on en génère un si aucun n'est fourni.
    add(placement) {
        if (!placement.id) {
            placement.id = crypto.randomUUID();
        }
        this.placedTroops.push(placement);
        this.selectedPlacedTroop = placement;
        this.emitChange("add", placement);
        return placement;
    }

    // Recherche une troupe posée par son id.
    findById(id) {
        return this.placedTroops.find(troop => troop.id === id) || null;
    }

    // Supprime une troupe posée.
    remove(placement) {
        const index = this.placedTroops.indexOf(placement);
        if (index === -1) {
            return false;
        }

        this.placedTroops.splice(index, 1);
        if (this.selectedPlacedTroop === placement) {
            this.selectedPlacedTroop = null;
        }

        this.emitChange("remove", placement);
        return true;
    }

    // Vide toutes les troupes posées.
    clear() {
        this.placedTroops.length = 0;
        this.selectedPlacedTroop = null;
        this.emitChange("clear");
    }

    // Sélectionne une troupe existante.
    select(placement) {
        this.selectedPlacedTroop = placement;
    }

    // Retourne la troupe sélectionnée.
    getSelected() {
        return this.selectedPlacedTroop;
    }

    // Recherche une troupe sous une position donnée.
    findAt(x, y) {
        for (let i = this.placedTroops.length - 1; i >= 0; i--) {
            const troop = this.placedTroops[i];
            const dx = x - troop.x;
            const dy = y - troop.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= troop.collision) {
                return troop;
            }
        }
        return null;
    }

    // Vérifie si une position est libre par rapport aux troupes déjà posées.
    isPositionFree(x, y, radius) {
        for (const placed of this.placedTroops) {
            const dx = x - placed.x;
            const dy = y - placed.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < radius + placed.collision) {
                return false;
            }
        }
        return true;
    }

    // Met à jour les propriétés d'une troupe posée.
    updatePlacement(placement, updates) {
        Object.assign(placement, updates);
        this.emitChange("update", placement);
    }
}
