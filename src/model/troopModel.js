// Modèle métier des troupes.
// Ce module gère les données des troupes et les calculs liés au niveau.
export class TroopModel {
    constructor(troopData = {}) {
        this.troopData = troopData;
    }

    // Met à jour les données de toutes les troupes.
    setTroopData(troopData) {
        this.troopData = troopData;
    }

    // Retourne les noms des troupes filtrés par recherche.
    getNames(filter = "") {
        const search = filter.toLowerCase();
        return Object.keys(this.troopData).filter(name =>
            name.toLowerCase().includes(search)
        );
    }

    // Retourne les données d'une troupe par nom.
    getTroop(name) {
        return this.troopData[name] || null;
    }

    // Retourne la valeur de collision d'une troupe.
    getCollision(name) {
        return this.getTroop(name)?.collision ?? 0;
    }

    // Retourne la portée de la troupe pour un niveau donné.
    getRange(name, level) {
        const troop = this.getTroop(name);
        if (!troop) {
            return 0;
        }

        const index = Math.min(level, troop.rangeMultiplier.length - 1);
        return troop.rangeMultiplier[index] ?? 0;
    }
}
