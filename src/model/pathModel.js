import { distanceToSegment } from "../util/geometry.js";

// Rayon de détection au clic, en coordonnées monde (même logique que TextLabelModel.LABEL_HIT_RADIUS).
const PATH_HIT_RADIUS = 18;

// Modèle des chemins (routes ennemies) tracés sur la carte — fonctionnalité admin uniquement.
// Même pattern que PolygonModel/TextLabelModel (onChange/emitChange), pour que HistoryController
// puisse le traiter comme n'importe quelle autre mutation.
// Volontairement isolé du pipeline save/share : ce modèle n'est jamais lu ni écrit par
// createSaveData/parseSaveData/loadFromStorage (voir saveService.js) ; il n'est exposé que via
// son propre textarea JSON dans UIController.handleShowPathJson/handleApplyPathJson.
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

    // Ajoute un nouveau chemin et le sélectionne. `path.points` : [{x,y}, ...] en coordonnées monde.
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

    // Dernier chemin au-dessus dont un segment passe à moins de PATH_HIT_RADIUS de (x, y).
    // Pas de test "point-dans-forme" : un chemin est une polyligne ouverte, pas une zone fermée
    // — chaque segment est testé individuellement via distanceToSegment.
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
