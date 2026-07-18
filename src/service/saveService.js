import LZString from "../util/lz-string.js";
// Service de sauvegarde et de chargement des données de placement.

const AUTO_SAVE_KEY = "tds-mapper-autosave";

// Crée un objet de sauvegarde à partir des troupes placées et des zones dessinées.
export function createSaveData(placedTroops, mapName = null, placedPolygons = []) {
    return {
        version: 1,
        mapName,
        troops: placedTroops.map(troop => ({
            troop: troop.troop,
            level: troop.level,
            x: Math.round(troop.x),
            y: Math.round(troop.y),
            color: troop.color,
            player: troop.player
        })),
        zones: placedPolygons.map(polygon => ({
            color: polygon.color,
            points: polygon.points.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) }))
        }))
    };
}

// Analyse le JSON de sauvegarde et renvoie un objet utilisable par l'application.
export function parseSaveData(jsonText) {
    const payload = JSON.parse(jsonText);
    return isCompactSaveData(payload) ? expandCompactSaveData(payload) : payload;
}

// Format compact ("maison") : dictionnaires de troupes/couleurs + tableaux de valeurs brutes
// (pas de clés répétées), utilisé quand le JSON classique produit une URL trop longue.
export function createCompactSaveData(placedTroops, mapName = null, placedPolygons = []) {
    const troopDict = [];
    const troopIndex = new Map();
    const colorDict = [];
    const colorIndex = new Map();

    const getTroopIdx = (name) => {
        if (!troopIndex.has(name)) {
            troopIndex.set(name, troopDict.length);
            troopDict.push(name);
        }
        return troopIndex.get(name);
    };
    const getColorIdx = (color) => {
        if (!colorIndex.has(color)) {
            colorIndex.set(color, colorDict.length);
            colorDict.push(color);
        }
        return colorIndex.get(color);
    };

    const t = placedTroops.map(troop => [
        getTroopIdx(troop.troop),
        troop.level,
        Math.round(troop.x),
        Math.round(troop.y),
        getColorIdx(troop.color),
        Number(String(troop.player).replace(/\D/g, "")) || 1
    ]);

    // Zone = [couleurIdx, x1, y1, x2, y2, ...] : réutilise le dictionnaire de couleurs des troupes.
    const pg = placedPolygons.map(polygon => [
        getColorIdx(polygon.color),
        ...polygon.points.flatMap(point => [Math.round(point.x), Math.round(point.y)])
    ]);

    return { version: 2, mapName, td: troopDict, cd: colorDict, t, pg };
}

export function isCompactSaveData(payload) {
    return Boolean(payload) && payload.version === 2 && Array.isArray(payload.t);
}

// Reconstruit la forme classique { version: 1, mapName, troops: [...], zones: [...] } depuis le format compact.
export function expandCompactSaveData(compact) {
    const { td = [], cd = [], t = [], pg = [], mapName = null } = compact;
    return {
        version: 1,
        mapName,
        troops: t.map(([troopIdx, level, x, y, colorIdx, playerNum]) => ({
            troop: td[troopIdx],
            level,
            x,
            y,
            color: cd[colorIdx],
            player: `player${playerNum}`
        })),
        zones: pg.map(([colorIdx, ...coords]) => {
            const points = [];
            for (let i = 0; i < coords.length; i += 2) {
                points.push({ x: coords[i], y: coords[i + 1] });
            }
            return { color: cd[colorIdx], points };
        })
    };
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

export function loadFromLZString(encoded) {
    try {
        const json = LZString.decompressFromEncodedURIComponent(encoded);
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
