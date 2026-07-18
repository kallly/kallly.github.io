import { distance } from "../util/geometry.js";

// Rayon de détection au clic, en coordonnées monde (même logique que la collision d'une troupe).
const LABEL_HIT_RADIUS = 18;

// Modèle des étiquettes de texte posées sur la carte (20 caractères max, imposé à l'ajout).
// Même pattern que PlacementModel/PolygonModel (onChange/emitChange).
export class TextLabelModel {
    constructor() {
        this.labels = [];
        this.selectedLabel = null;
        this.listeners = [];
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    emitChange(type, label = null, previous = null) {
        for (const listener of this.listeners) {
            listener({ type, label, previous });
        }
    }

    // Ajoute une nouvelle étiquette et la sélectionne. `label` : { text, x, y }.
    add(label) {
        if (!label.id) {
            label.id = crypto.randomUUID();
        }
        this.labels.push(label);
        this.selectedLabel = label;
        this.emitChange("add", label);
        return label;
    }

    findById(id) {
        return this.labels.find(label => label.id === id) || null;
    }

    remove(label) {
        const index = this.labels.indexOf(label);
        if (index === -1) {
            return false;
        }

        this.labels.splice(index, 1);
        if (this.selectedLabel === label) {
            this.selectedLabel = null;
        }

        this.emitChange("remove", label);
        return true;
    }

    clear() {
        const previous = [...this.labels];
        this.labels.length = 0;
        this.selectedLabel = null;
        this.emitChange("clear", null, previous);
    }

    select(label) {
        this.selectedLabel = label;
    }

    getSelected() {
        return this.selectedLabel;
    }

    findAt(x, y) {
        for (let i = this.labels.length - 1; i >= 0; i--) {
            if (distance(x, y, this.labels[i].x, this.labels[i].y) <= LABEL_HIT_RADIUS) {
                return this.labels[i];
            }
        }
        return null;
    }
}
