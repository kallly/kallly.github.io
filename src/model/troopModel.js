export class TroopModel {
    constructor(troopData = {}, statsData = {}) {
        this.troopData = troopData;
        this.statsData = statsData;
    }

    setTroopData(troopData) {
        this.troopData = troopData;
    }

    setStatsData(statsData) {
        this.statsData = statsData;
    }

    getNames(filter = "") {
        const search = filter.toLowerCase();
        return Object.keys(this.troopData).filter(name =>
            name.toLowerCase().includes(search)
        );
    }

    getTroop(name) {
        return this.troopData[name] || null;
    }

    getCollision(name) {
        return this.getTroop(name)?.collision ?? 0;
    }

    // Dernier index de rangeMultiplier.
    getMaxLevel(name) {
        const troop = this.getTroop(name);
        return troop ? troop.rangeMultiplier.length - 1 : 10;
    }

    getRange(name, level) {
        const troop = this.getTroop(name);
        if (!troop) {
            return 0;
        }

        const index = Math.min(level, troop.rangeMultiplier.length - 1);
        return troop.rangeMultiplier[index] ?? 0;
    }

    // null si inconnue ou sans DPS (ex: Farm).
    getDps(name, level) {
        const troop = this.statsData[name];
        if (!troop) {
            return null;
        }

        const index = Math.min(level, troop.levels.length - 1);
        return troop.levels[index]?.DPS ?? null;
    }
}
