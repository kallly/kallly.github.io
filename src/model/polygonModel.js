import { pointInPolygon } from "../util/geometry.js";

export class PolygonModel {
    constructor() {
        this.polygons = [];
        this.selectedPolygon = null;
        this.listeners = [];
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    emitChange(type, polygon = null, previous = null) {
        for (const listener of this.listeners) {
            listener({ type, polygon, previous });
        }
    }

    add(polygon) {
        if (!polygon.id) {
            polygon.id = crypto.randomUUID();
        }
        this.polygons.push(polygon);
        this.selectedPolygon = polygon;
        this.emitChange("add", polygon);
        return polygon;
    }

    findById(id) {
        return this.polygons.find(polygon => polygon.id === id) || null;
    }

    remove(polygon) {
        const index = this.polygons.indexOf(polygon);
        if (index === -1) {
            return false;
        }

        this.polygons.splice(index, 1);
        if (this.selectedPolygon === polygon) {
            this.selectedPolygon = null;
        }

        this.emitChange("remove", polygon);
        return true;
    }

    clear() {
        const previous = [...this.polygons];
        this.polygons.length = 0;
        this.selectedPolygon = null;
        this.emitChange("clear", null, previous);
    }

    select(polygon) {
        this.selectedPolygon = polygon;
    }

    getSelected() {
        return this.selectedPolygon;
    }

    findAt(x, y) {
        for (let i = this.polygons.length - 1; i >= 0; i--) {
            if (pointInPolygon(x, y, this.polygons[i].points)) {
                return this.polygons[i];
            }
        }
        return null;
    }

    updatePolygon(polygon, updates) {
        const previous = {};
        for (const key of Object.keys(updates)) {
            previous[key] = polygon[key];
        }
        Object.assign(polygon, updates);
        this.emitChange("update", polygon, previous);
    }
}
