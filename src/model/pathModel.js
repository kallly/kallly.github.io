import { distanceToSegment } from "../util/geometry.js";

// Rayon de détection au clic, en coordonnées monde (même logique que TextLabelModel.LABEL_HIT_RADIUS).
const PATH_HIT_RADIUS = 18;

// Volontairement isolé du pipeline save/share : jamais lu ni écrit par createSaveData/parseSaveData/loadFromStorage, exposé seulement via UIController.handleShowPathJson/handleApplyPathJson.
export class PathModel {
    constructor() {
        this.paths = [];
        this.selectedPath = null;
        this.listeners = [];
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    emitChange(type, path = null, previous = null) {
        for (const listener of this.listeners) {
            listener({ type, path, previous });
        }
    }

    add(path) {
        if (!path.id) {
            path.id = crypto.randomUUID();
        }
        this.paths.push(path);
        this.selectedPath = path;
        this.emitChange("add", path);
        return path;
    }

    findById(id) {
        return this.paths.find(path => path.id === id) || null;
    }

    remove(path) {
        const index = this.paths.indexOf(path);
        if (index === -1) {
            return false;
        }

        this.paths.splice(index, 1);
        if (this.selectedPath === path) {
            this.selectedPath = null;
        }

        this.emitChange("remove", path);
        return true;
    }

    clear() {
        const previous = [...this.paths];
        this.paths.length = 0;
        this.selectedPath = null;
        this.emitChange("clear", null, previous);
    }

    select(path) {
        this.selectedPath = path;
    }

    getSelected() {
        return this.selectedPath;
    }

    // Pas de test "point-dans-forme" : un chemin est une polyligne ouverte, chaque segment est testé via distanceToSegment.
    findAt(x, y) {
        for (let i = this.paths.length - 1; i >= 0; i--) {
            const points = this.paths[i].points;
            for (let j = 0; j < points.length - 1; j++) {
                if (distanceToSegment(x, y, points[j].x, points[j].y, points[j + 1].x, points[j + 1].y) <= PATH_HIT_RADIUS) {
                    return this.paths[i];
                }
            }
        }
        return null;
    }

    updatePath(path, updates) {
        const previous = {};
        for (const key of Object.keys(updates)) {
            previous[key] = path[key];
        }
        Object.assign(path, updates);
        this.emitChange("update", path, previous);
    }
}
