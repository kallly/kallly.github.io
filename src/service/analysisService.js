// Chargement paresseux (déclenché par l'ouverture du panneau d'analyse admin), mis en cache.
let cachedAnalysisData = null;

export async function loadAnalysisData() {
    if (cachedAnalysisData) {
        return cachedAnalysisData;
    }

    const [hardcoreResponse, statsResponse] = await Promise.all([
        fetch("data/hardcore_data.json"),
        fetch("data/tds_stats.json")
    ]);

    if (!hardcoreResponse.ok) {
        throw new Error(`Unable to load hardcore_data.json (${hardcoreResponse.status})`);
    }
    if (!statsResponse.ok) {
        throw new Error(`Unable to load tds_stats.json (${statsResponse.status})`);
    }

    const hardcoreData = await hardcoreResponse.json();
    const tdsStats = await statsResponse.json();

    cachedAnalysisData = { waves: hardcoreData.waves, enemies: hardcoreData.enemies, tdsStats };
    return cachedAnalysisData;
}

// Dupliqué depuis pages/hardcore_damage_forecast.js (hors bundle src/, pas d'import possible,
// voir docs/features/hardcore-pages.md). Divergence assumée : vagues 43/45 = `Infinity` ici
// (pas de vague suivante à rater) alors que cette copie utilise 300s pour son graphique de DPS.
const WAVE_TIMER_RANGES = [
    [1, 3, 15], [4, 6, 20], [7, 9, 25], [10, 13, 20], [14, 15, 25], [16, 17, 50],
    [18, 18, 35], [19, 19, 90], [20, 21, 35], [22, 25, 45], [26, 26, 20],
    [27, 27, 25], [28, 28, 30], [29, 29, 50], [30, 30, 150], [31, 32, 60],
    [33, 33, 240], [34, 34, 50], [35, 35, 60], [36, 36, 180], [37, 37, 60],
    [38, 38, 90], [39, 39, 60], [40, 40, 240], [41, 41, 90], [42, 42, 120],
    [43, 43, 120], [44, 44, 180], [45, 45, 300]
];
const WAVE_TIMER_SECONDS = {};
WAVE_TIMER_RANGES.forEach(([min, max, seconds]) => {
    for (let w = min; w <= max; w++) {
        WAVE_TIMER_SECONDS[w] = seconds;
    }
});

export function getWaveTimerSeconds(waveNumber) {
    return WAVE_TIMER_SECONDS[waveNumber] ?? 30;
}

// Speed peut être un texte composé (ex: "Fast (6, With Balloon); Above Average (4...)") ; on
// extrait le premier nombre par regex (parseFloat seul échoue si la chaîne ne commence pas par
// un chiffre). `approximate` signale à l'appelant que la valeur n'était pas un nombre propre.
export function parseEnemySpeed(rawSpeed) {
    const clean = Number(String(rawSpeed).trim());
    if (Number.isFinite(clean)) {
        return { value: clean, approximate: false };
    }
    const match = String(rawSpeed).match(/[\d.]+/);
    const loose = match ? parseFloat(match[0]) : NaN;
    return { value: Number.isFinite(loose) ? loose : null, approximate: Number.isFinite(loose) };
}

// Règle validée : pour les chaînes multi-groupes "Level N (qualificatif)" (tours multi-branches
// type Commander/Kingpin), un groupe n'est retenu que si son qualificatif mentionne "Tower"
// (sinon la détection ne s'applique qu'à une unité invoquée, pas à la tour) — sinon retourne null.
export function parseDetectionLevel(raw) {
    if (raw == null) {
        return null;
    }
    const text = String(raw);
    const groupPattern = /(\d+)[A-Za-z]*\+?\s*\(([^)]*)\)/g;
    let match;
    let hasGroup = false;
    while ((match = groupPattern.exec(text)) !== null) {
        hasGroup = true;
        if (/tower/i.test(match[2])) {
            return parseInt(match[1], 10);
        }
    }
    if (hasGroup) {
        return null;
    }
    const numMatch = text.match(/\d+/);
    return numMatch ? parseInt(numMatch[0], 10) : null;
}

// Ne garde que le segment avant le premier ";" (cas par défaut/le plus courant).
export function parseEnemyFlag(raw) {
    if (raw == null) {
        return false;
    }
    const segment = String(raw).split(";")[0].trim();
    return /^yes/i.test(segment);
}

// Un modificateur de vague force le flag à vrai (ex. "Hidden" sur Cursed Skeleton = "Variable" de base).
function getEnemyFlags(enemyData, modifiers) {
    return {
        hidden: parseEnemyFlag(enemyData.Hidden) || modifiers.includes("Hidden"),
        flying: parseEnemyFlag(enemyData.Flying) || modifiers.includes("Flying"),
        lead: parseEnemyFlag(enemyData.Lead) || modifiers.includes("Lead")
    };
}

function towerHasDetection(raw, level) {
    const required = parseDetectionLevel(raw);
    return required !== null && level >= required;
}

function canTowerHitEnemy(tower, flags) {
    if (flags.hidden && !towerHasDetection(tower.detections?.hidden, tower.level)) {
        return false;
    }
    if (flags.flying && !towerHasDetection(tower.detections?.flying, tower.level)) {
        return false;
    }
    if (flags.lead && !towerHasDetection(tower.detections?.lead, tower.level)) {
        return false;
    }
    return true;
}

// Ordre du tableau = ordre suivi par la cascade de report de dégâts ci-dessous.
function expandWaveEnemies(wave, enemies) {
    const instances = [];

    for (let groupIndex = 0; groupIndex < wave.enemies.length; groupIndex++) {
        const entry = wave.enemies[groupIndex];
        const enemyData = enemies.find(e => e.Enemy === entry.enemy);
        const health = enemyData ? enemyData["Base Health (Hardcore)"] ?? null : null;
        const flags = enemyData ? getEnemyFlags(enemyData, entry.modifiers) : null;

        for (let n = 0; n < entry.count; n++) {
            if (!enemyData || health === null) {
                instances.push({ groupIndex, unavailable: true });
                continue;
            }
            const { value: speed, approximate } = parseEnemySpeed(enemyData.Speed);
            instances.push({ groupIndex, speed, approximate, stationary: !(speed > 0), health, killed: false, flags });
        }
    }

    return instances;
}


// timeToCross_tour = (duration / instance.speed) * tower.pathCoverage, réduit du timeDeficit
// accumulé (retard pris sur les kills précédents, cf. evaluateWaveDamage) : les tours à faible
// pathCoverage décrochent plus tôt. killTime simule cette perte progressive de DPS cumulé pour
// trouver l'instant où instance.health atteint 0 (Infinity si jamais atteint).
function computeEnemyDamage(instance, duration, towers, timeDeficit) {
    const eligibleTowers = towers.filter(tower => canTowerHitEnemy(tower, instance.flags));

    if (instance.stationary) {
        const rate = eligibleTowers.reduce((total, tower) => total + tower.dps * tower.pathCoverage, 0);
        const damage = eligibleTowers.some(tower => tower.pathCoverage > 0) ? Infinity : 0;
        const killTime = rate > 0 ? instance.health / rate : Infinity;
        return { damage, killTime };
    }

    const engagements = eligibleTowers
        .map(tower => ({
            dps: tower.dps,
            timeToCross: Math.max(0, (duration / instance.speed) * tower.pathCoverage - timeDeficit)
        }))
        .filter(engagement => engagement.timeToCross > 0)
        .sort((a, b) => a.timeToCross - b.timeToCross);

    const damage = engagements.reduce((total, engagement) => total + engagement.dps * 1.4 * engagement.timeToCross, 0);

    let remainingHealth = instance.health;
    let elapsed = 0;
    let killTime = Infinity;
    for (let i = 0; i < engagements.length; i++) {
        const activeRate = engagements.slice(i).reduce((total, engagement) => total + engagement.dps * 1.4, 0);
        const segmentDamage = activeRate * (engagements[i].timeToCross - elapsed);
        if (remainingHealth <= segmentDamage) {
            killTime = elapsed + remainingHealth / activeRate;
            break;
        }
        remainingHealth -= segmentDamage;
        elapsed = engagements[i].timeToCross;
    }

    return { damage, killTime };
}

const FLAG_LABELS = [["hidden", "Hidden"], ["flying", "Flying"], ["lead", "Lead"]];

// Distingue "aucune tour adaptée" (détection manquante) de "DPS insuffisant" (tours adaptées présentes).
function describeDefeatReason(flags, towers) {
    const activeLabels = FLAG_LABELS.filter(([key]) => flags[key]).map(([, label]) => label);
    if (activeLabels.length === 0) {
        return "Insufficient damage";
    }
    const hasAdaptedTroop = towers.some(tower => canTowerHitEnemy(tower, flags));
    return hasAdaptedTroop
        ? `Insufficient damage (${activeLabels.join("/")})`
        : `No troop with ${activeLabels.join("/")} detection`;
}

function aggregateByGroup(wave, instances, towers) {
    return wave.enemies.map((entry, groupIndex) => {
        const groupInstances = instances.filter(i => i.groupIndex === groupIndex);
        const first = groupInstances[0];

        if (!first || first.unavailable) {
            return { enemy: entry.enemy, count: entry.count, modifiers: entry.modifiers, unavailable: true };
        }

        const survivedCount = groupInstances.filter(i => !i.killed).length;

        return {
            enemy: entry.enemy, count: entry.count, modifiers: entry.modifiers,
            speed: first.speed, approximate: first.approximate, health: first.health, stationary: first.stationary,
            killedCount: groupInstances.filter(i => i.killed).length,
            survivedCount,
            defeatReason: survivedCount > 0 ? describeDefeatReason(first.flags, towers) : null
        };
    });
}

const RISK_MARGIN = 0.2; // validé avec l'utilisateur : 20% de marge sous le timer = LOW

// Constante fixe validée avec l'utilisateur (pas dérivée par ennemi/vague). Seuil de la file
// cumulative `timeDeficit` (cf. evaluateWaveDamage) : un kill plus long grignote la fenêtre
// d'exposition du suivant (et permet à `carry` de s'y propager) ; un kill plus court la réduit.
const ENEMY_SPAWN_GAP_SECONDS = 1;

// HIGH forcé si la vague n'est pas entièrement nettoyée ; sinon LOW/MEDIUM/HIGH selon marge RISK_MARGIN.
function computeWaveRisk(wave, allKilled, clearTime, waveTimerSeconds) {
    if (!allKilled) {
        return "HIGH";
    }
    if (waveTimerSeconds === Infinity || clearTime <= waveTimerSeconds * (1 - RISK_MARGIN)) {
        return "LOW";
    }
    return clearTime * (1+(wave/45)) <= waveTimerSeconds ? "MEDIUM" : "HIGH";
}

export function evaluateWaveDamage(wave, enemies, duration, towers) {
    const instances = expandWaveEnemies(wave, enemies);
    let carry = 0;
    let clearTime = 0;
    let allKilled = true;
    let timeDeficit = 0;

    for (const instance of instances) {
        if (instance.unavailable) {
            allKilled = false;
            continue;
        }

        const neededHealth = Math.max(0, instance.health - carry);
        const { damage: rawDamage, killTime } = computeEnemyDamage({ ...instance, health: neededHealth }, duration, towers, timeDeficit);
        if (rawDamage >= neededHealth) {
            instance.killed = true;
            clearTime += killTime;
            timeDeficit = Math.max(0, timeDeficit + killTime - ENEMY_SPAWN_GAP_SECONDS);
            carry = (!instance.stationary && timeDeficit > 1) ? rawDamage - neededHealth : 0;
            console.log(carry, timeDeficit)

        } else {
            instance.killed = false;
            carry = 0;
            allKilled = false;
        }
    }
    clearTime += timeDeficit

    const waveTimerSeconds = getWaveTimerSeconds(wave.wave);
    const risk = computeWaveRisk(wave.wave, allKilled, clearTime, waveTimerSeconds);

    return { groups: aggregateByGroup(wave, instances, towers), clearTime, allKilled, risk, waveTimerSeconds };
}
