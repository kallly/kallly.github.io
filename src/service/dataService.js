// Service de chargement des données JSON.
// Ce module lit les fichiers de configuration et normalise les valeurs pour l'application.
export async function loadData() {
    const [mapsResponse, troopsResponse] = await Promise.all([
        fetch("data/maps.json"),
        fetch("data/troops.json")
    ]);

    if (!mapsResponse.ok) {
        throw new Error(`Impossible de charger maps.json (${mapsResponse.status})`);
    }

    if (!troopsResponse.ok) {
        throw new Error(`Impossible de charger troops.json (${troopsResponse.status})`);
    }

    const maps = await mapsResponse.json();
    const troops = await troopsResponse.json();

    normalizeTroops(troops);

    return { maps, troops };
}

// Normalise les données des troupes pour garantir que collision est un nombre
// et que rangeMultiplier est un tableau de nombres.
function normalizeTroops(troops) {
    for (const troopName in troops) {
        const troop = troops[troopName];
        troop.collision = Number(troop.collision);
        if (!Array.isArray(troop.rangeMultiplier)) {
            troop.rangeMultiplier = [];
        } else {
            troop.rangeMultiplier = troop.rangeMultiplier.map(Number);
        }
    }
}
