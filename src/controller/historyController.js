// Historique des actions locales sur le placement des troupes (ajout/suppression/modification/
// vidage), pour permettre d'annuler (rollback) les dernières actions les unes après les autres.
// N'enregistre que les mutations locales : les mutations reçues d'un coéquipier (collaboration)
// ne sont pas ajoutées à cet historique, pour ne jamais annuler l'action de quelqu'un d'autre.
const MAX_HISTORY = 50;

export class HistoryController {
    constructor({ state, placementModel }) {
        this.state = state;
        this.placementModel = placementModel;
        this.stack = [];
        this.isApplyingUndo = false;

        this.placementModel.onChange((event) => this.recordChange(event));
    }

    // Empile l'action inverse de la mutation reçue, sauf si elle vient d'un undo ou du réseau.
    recordChange({ type, placement, previous }) {
        if (this.isApplyingUndo || this.state.isApplyingRemoteChange) {
            return;
        }

        switch (type) {
            case "add":
                this.push({ type: "add", placement });
                break;
            case "remove":
                this.push({ type: "remove", placement });
                break;
            case "update":
                this.push({ type: "update", placement, previous });
                break;
            case "clear":
                if (previous.length > 0) {
                    this.push({ type: "clear", previous });
                }
                break;
        }
    }

    push(action) {
        this.stack.push(action);
        if (this.stack.length > MAX_HISTORY) {
            this.stack.shift();
        }
    }

    canUndo() {
        return this.stack.length > 0;
    }

    // Annule la dernière action locale enregistrée. Retourne false s'il n'y avait rien à annuler.
    undo() {
        const action = this.stack.pop();
        if (!action) {
            return false;
        }

        this.isApplyingUndo = true;
        switch (action.type) {
            case "add":
                this.placementModel.remove(action.placement);
                break;
            case "remove":
                this.placementModel.add(action.placement);
                break;
            case "update":
                this.placementModel.updatePlacement(action.placement, action.previous);
                break;
            case "clear":
                for (const placement of action.previous) {
                    this.placementModel.add(placement);
                }
                break;
        }
        this.isApplyingUndo = false;

        return true;
    }
}
