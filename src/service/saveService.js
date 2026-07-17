// Service de sauvegarde et de chargement des données de placement.

const AUTO_SAVE_KEY = "tds-mapper-autosave";

// Crée un objet de sauvegarde à partir des troupes placées.
export function createSaveData(placedTroops, mapName = null) {
    return {
        version: 1,
        mapName,
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

export function encodeBase64(text) {
    const uint8 = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < uint8.length; i += 1) {
        binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
}

function decodeBase64(base64) {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        buffer[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(buffer);
}

export function saveToStorage(payload) {
    try {
        const json = JSON.stringify(payload);
        const encoded = encodeBase64(json);
        localStorage.setItem(AUTO_SAVE_KEY, encoded);
    }
    catch (error) {
        console.error("Impossible de sauvegarder dans localStorage :", error);
    }
}

export function loadFromStorage() {
    try {
        const encoded = localStorage.getItem(AUTO_SAVE_KEY);
        if (!encoded) {
            return null;
        }
        return loadFromBase64(encoded);
    }
    catch (error) {
        console.error("Impossible de charger depuis localStorage :", error);
        return null;
    }
}

export function loadFromBase64(base64) {
    try {
        const json = decodeBase64(base64);
        return parseSaveData(json);
    }
    catch (error) {
        console.error("Impossible de charger depuis la base64 :", error);
        return null;
    }
}

export function clearStorage() {
    localStorage.removeItem(AUTO_SAVE_KEY);
}
