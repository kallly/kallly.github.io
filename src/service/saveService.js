// Service de sauvegarde et de chargement des données de placement.

// Crée un objet de sauvegarde à partir des troupes placées.
export function createSaveData(placedTroops) {
    return {
        version: 1,
        troops: placedTroops.map(troop => ({
            troop: troop.troop,
            level: troop.level,
            x: Math.round(troop.x),
            y: Math.round(troop.y),
            color: troop.color
        }))
    };
}

// Analyse le JSON de sauvegarde et renvoie un objet utilisable par l'application.
export function parseSaveData(jsonText) {
    return JSON.parse(jsonText);
}
