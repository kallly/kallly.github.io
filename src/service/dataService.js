export async function loadData() {
    const [mapsResponse, troopsResponse, statsResponse] = await Promise.all([
        fetch("data/maps.json"),
        fetch("data/troops.json"),
        fetch("data/tds_stats.json")
    ]);

    if (!mapsResponse.ok) {
        throw new Error(`Unable to load maps.json (${mapsResponse.status})`);
    }

    if (!troopsResponse.ok) {
        throw new Error(`Unable to load troops.json (${troopsResponse.status})`);
    }

    if (!statsResponse.ok) {
        throw new Error(`Unable to load tds_stats.json (${statsResponse.status})`);
    }

    const maps = await mapsResponse.json();
    const troops = await troopsResponse.json();
    const stats = await statsResponse.json();

    normalizeTroops(troops);

    return { maps, troops, stats };
}

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
