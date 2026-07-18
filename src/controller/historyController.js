// Historique des actions locales sur le placement des troupes (ajout/suppression/modification/
// vidage), pour permettre d'annuler (rollback) les dernières actions les unes après les autres.
// N'enregistre que les mutations locales : les mutations reçues d'un coéquipier (collaboration)
// ne sont pas ajoutées à cet historique, pour ne jamais annuler l'action de quelqu'un d'autre.
const MAX_HISTORY = 50;

export class HistoryController {
    constructor({ state, placementModel, polygonModel = null, textLabelModel = null }) {
        this.state = state;
        this.placementModel = placementModel;
        this.polygonModel = polygonModel;
        this.textLabelModel = textLabelModel;
        this.stack = [];
        this.isApplyingUndo = false;

        this.placementModel.onChange((event) => this.recordChange("placement", event.type, event.placement, event.previous));
        this.polygonModel?.onChange((event) => this.recordChange("polygon", event.type, event.polygon, event.previous));
        this.textLabelModel?.onChange((event) => this.recordChange("label", event.type, event.label, event.previous));
    }

    // Empile l'action inverse de la mutation reçue, sauf si elle vient d'un undo ou du réseau.
    // `source` indique quel modèle (troupes ou zones) rejouer lors d'un undo.
    recordChange(source, type, item, previous) {
        if (this.isApplyingUndo || this.state.isApplyingRemoteChange) {
            return;
        }

        switch (type) {
            case "add":
                this.push({ source, type: "add", item });
                break;
            case "remove":
                this.push({ source, type: "remove", item });
                break;
            case "update":
                this.push({ source, type: "update", item, previous });
                break;
            case "clear":
                if (previous.length > 0) {
                    this.push({ source, type: "clear", previous });
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

        const model = action.source === "polygon" ? this.polygonModel
            : action.source === "label" ? this.textLabelModel
            : this.placementModel;
        // Seules les troupes et les zones ont des mutations "update" (les textes n'en émettent jamais).
        const updateMethod = action.source === "polygon" ? "updatePolygon" : "updatePlacement";

        this.isApplyingUndo = true;
        switch (action.type) {
            case "add":
                model.remove(action.item);
                break;
            case "remove":
                model.add(action.item);
                break;
            case "update":
                model[updateMethod](action.item, action.previous);
                break;
            case "clear":
                for (const item of action.previous) {
                    model.add(item);
                }
                break;
        }
        this.isApplyingUndo = false;

        return true;
    }
}
