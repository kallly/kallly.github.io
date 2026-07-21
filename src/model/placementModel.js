export class PlacementModel {
    constructor() {
        this.placedTroops = [];
        this.selectedPlacedTroop = null;
        this.listeners = [];
    }

    // Plusieurs abonnés sont possibles (contrairement au on/dispatch de SidebarView).
    onChange(callback) {
        this.listeners.push(callback);
    }

    // `previous` porte de quoi inverser la mutation (utilisé par HistoryController).
    emitChange(type, placement = null, previous = null) {
        for (const listener of this.listeners) {
            listener({ type, placement, previous });
        }
    }

    // Id stable nécessaire pour cibler cette troupe depuis un événement distant (collaboration).
    add(placement) {
        if (!placement.id) {
            placement.id = crypto.randomUUID();
        }
        this.placedTroops.push(placement);
        this.selectedPlacedTroop = placement;
        this.emitChange("add", placement);
        return placement;
    }

    findById(id) {
        return this.placedTroops.find(troop => troop.id === id) || null;
    }

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

    clear() {
        const previous = [...this.placedTroops];
        this.placedTroops.length = 0;
        this.selectedPlacedTroop = null;
        this.emitChange("clear", null, previous);
    }

    select(placement) {
        this.selectedPlacedTroop = placement;
    }

    getSelected() {
        return this.selectedPlacedTroop;
    }

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

    updatePlacement(placement, updates) {
        const previous = {};
        for (const key of Object.keys(updates)) {
            previous[key] = placement[key];
        }
        Object.assign(placement, updates);
        this.emitChange("update", placement, previous);
    }
}
