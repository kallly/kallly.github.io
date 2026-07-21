// Charge (une seule fois, mis en cache) les données nécessaires à l'analyse de vague : le
// roster ennemi/vagues Hardcore et les statistiques de combat des tours (absentes de troops.json,
// qui ne contient que collision/rangeMultiplier). Chargement paresseux : uniquement déclenché par
// l'ouverture du panneau d'analyse (admin), pour ne pas alourdir le chargement normal de la page.
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

// Minuteur officiel Hardcore (temps en secondes avant le lancement de la vague suivante), dupliqué
// depuis pages/hardcore_damage_forecast.js (ces pages restent volontairement hors du bundle src/,
// voir docs/features/hardcore-pages.md, donc pas d'import possible entre les deux). Divergence
// assumée par rapport à cette copie : les vagues 43 et 45 y utilisent un cap de 300s (pour obtenir
// un chiffre de DPS affichable sur un graphique) alors qu'ici elles sont volontairement `Infinity`
// (aucune vague suivante à rater ⇒ toujours sans risque temporel, cf. computeWaveRisk).
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

// Extrait un nombre du champ Speed (souvent "4", parfois un texte composé de valeurs
// conditionnelles, ex: "Fast (6, With Balloon); Above Average (4, Without Balloon)").
// `approximate` est vrai quand la chaîne brute n'était pas déjà un nombre propre — l'appelant
// doit le signaler visuellement plutôt que présenter la valeur comme fiable.
// Note : parseFloat() seul échoue sur ces chaînes composées (il ne lit que depuis le tout début
// de la chaîne, "Fast (6, ..." ne commence pas par un chiffre) — d'où la recherche par regex.
export function parseEnemySpeed(rawSpeed) {
    const clean = Number(String(rawSpeed).trim());
    if (Number.isFinite(clean)) {
        return { value: clean, approximate: false };
    }
    const match = String(rawSpeed).match(/[\d.]+/);
    const loose = match ? parseFloat(match[0]) : NaN;
    return { value: Number.isFinite(loose) ? loose : null, approximate: Number.isFinite(loose) };
}

// Extrait le niveau minimum requis du champ `detections.{hidden,lead,flying}` d'une tour
// (tds_stats.json), ex. "Level 2+", "Level 0", "Level 4B+", ou une chaîne composée de plusieurs
// groupes "Level N (qualificatif)" concaténés (tours multi-branches type Commander/Kingpin).
// Règle validée : quand un groupe a un qualificatif entre parenthèses, il n'est retenu que si ce
// qualificatif mentionne "Tower" (sinon la détection ne s'applique qu'à une unité invoquée/un
// effet secondaire, pas à la tour elle-même) — si aucun groupe ne mentionne "Tower", retourne null
// même si des chiffres sont présents dans la chaîne.
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

// Interprète les champs Hidden/Flying/Lead d'un ennemi (hardcore_data.json), en texte libre
// ("Yes", "No", "Yes (With covering)", "Yes (With Balloon); No (Without Balloon)", "Variable").
// Ne garde que le segment avant le premier ";" (le cas par défaut/le plus courant).
export function parseEnemyFlag(raw) {
    if (raw == null) {
        return false;
    }
    const segment = String(raw).split(";")[0].trim();
    return /^yes/i.test(segment);
}

// Combine les flags de base de l'ennemi avec les modificateurs de la vague (ex. "Hidden" sur
// Cursed Skeleton, dont le champ de base est "Variable") — un modificateur force le flag à vrai.
function getEnemyFlags(enemyData, modifiers) {
    return {
        hidden: parseEnemyFlag(enemyData.Hidden) || modifiers.includes("Hidden"),
        flying: parseEnemyFlag(enemyData.Flying) || modifiers.includes("Flying"),
        lead: parseEnemyFlag(enemyData.Lead) || modifiers.includes("Lead")
    };
}

// Une tour ne peut infliger de dégâts à un ennemi Hidden/Flying/Lead que si elle a débloqué la
// détection correspondante à son niveau placé (`tower.detections`/`tower.level`, cf. uiController).
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

// Développe les groupes {count, enemy, modifiers} d'une vague en instances individuelles, dans
// l'ordre du tableau (c'est cet ordre que suit la cascade de report de dégâts ci-dessous).
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


function computeEnemyDamage(instance, duration, towers, timeDeficit) {
    const eligibleTowers = towers.filter(tower => canTowerHitEnemy(tower, instance.flags));
    const rate = eligibleTowers.reduce((total, tower) => total + tower.dps * tower.pathCoverage, 0);
    if (instance.stationary) {
        return { damage: eligibleTowers.some(tower => tower.pathCoverage > 0) ? Infinity : 0, rate };
    }
    const timeToCross = Math.max(0, duration / instance.speed - timeDeficit);
    return { damage: timeToCross * rate, rate };
}

// Libellés lisibles des types de ciblage actifs sur un ennemi, dans l'ordre d'affichage voulu.
const FLAG_LABELS = [["hidden", "Hidden"], ["flying", "Flying"], ["lead", "Lead"]];

// Explique pourquoi un groupe a des survivants : soit aucune tour placée n'a débloqué la détection
// requise ("pas de troupe adaptée"), soit des tours adaptées existent mais leur DPS cumulé est
// insuffisant — dans les deux cas, on précise le(s) type(s) de ciblage en cause (Hidden/Flying/Lead),
// ou un message générique si l'ennemi n'a aucune restriction de ciblage (juste trop de PV/trop rapide).
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

// Espacement supposé (secondes) entre l'apparition de deux ennemis consécutifs de la vague —
// constante fixe validée avec l'utilisateur, pas dérivée d'une donnée par ennemi/vague. Sert de
// seuil dans la file cumulative de `timeDeficit` (cf. evaluateWaveDamage) : chaque kill plus long
// que ce délai grignote d'autant la fenêtre d'exposition de l'ennemi suivant (et permet à `carry`
// de s'y propager) ; des kills plus courts font redescendre le déficit accumulé.
const ENEMY_SPAWN_GAP_SECONDS = 1;

// Badge de risque temporel : HIGH forcé si la vague n'est pas entièrement nettoyée (peu importe
// clearTime, qui n'a alors pas de sens) ; sinon LOW si le clear tient dans 80% du Wave Timer,
// MEDIUM s'il dépasse cette marge sans dépasser le timer, HIGH s'il dépasse le timer.
function computeWaveRisk(allKilled, clearTime, waveTimerSeconds) {
    if (!allKilled) {
        return "HIGH";
    }
    if (waveTimerSeconds === Infinity || clearTime <= waveTimerSeconds * (1 - RISK_MARGIN)) {
        return "LOW";
    }
    return clearTime <= waveTimerSeconds ? "MEDIUM" : "HIGH";
}

// Évalue une vague contre un ensemble de tours placées (`{ dps, pathCoverage, level, detections }`) :
// les ennemis sont traités individuellement, dans l'ordre de la vague. Chacun encaisse son propre
// dégât (cf. computeEnemyDamage) plus le report du précédent (`carry`) ; si le total atteint ses PV,
// il est tué (le premier ennemi absorbe le plus de dégâts, comme une tour qui viserait toujours
// l'ennemi le plus avancé), sinon il survit et `carry` retombe à 0.
// `carry` n'est retenu pour l'ennemi suivant que si `timeDeficit` (voir plus bas) est encore positif
// juste après ce kill — càd seulement si un ennemi suivant est déjà "empilé" dans la file parce que
// ce kill a pris plus que le délai de spawn : dans ce cas seulement, les dégâts en trop trouvent une
// cible réelle immédiatement. Si `timeDeficit` est retombé à 0 (kill largement dans les temps, rien
// n'attend encore derrière), l'excédent est perdu — sinon un ennemi faible tué quasi instantanément
// "économiserait" tout son budget de dégâts théorique (calculé sur SA traversée complète du chemin,
// largement surdimensionné pour un ennemi faible face à un gros DPS) et l'offrirait gratuitement au
// suivant ; cumulé sur toute une vague, ça pouvait faire "mourir" gratuitement un boss loin derrière
// sans lui infliger de dégâts réels (cf. docs/decisions.md). Un ennemi stationnaire tué ne génère
// jamais de `carry`, quel que soit `timeDeficit` (un report infini casserait la cascade).
// `clearTime` accumule, dans ce même ordre, le temps nécessaire pour combler `health - carry` au
// débit `rate` de chaque ennemi tué (pas une simulation position par position, cf. docs/decisions.md)
// — n'a de sens que si `allKilled` est vrai (vague entièrement nettoyée). `timeDeficit` modélise un
// espacement supposé d'`ENEMY_SPAWN_GAP_SECONDS` entre deux ennemis, en file cumulative : chaque kill
// ajoute `killTime - ENEMY_SPAWN_GAP_SECONDS` au déficit courant (plancher 0, jamais négatif — un
// ennemi ne peut pas être exposé plus longtemps que sa propre traversée complète du chemin) ; des
// kills rapides répétés le font redescendre progressivement vers 0 (rattrapage du retard), un kill
// lent le fait grimper. Il réduit d'autant `timeToCross` de l'ennemi suivant (cf. computeEnemyDamage)
// et, comme détaillé ci-dessus, conditionne la propagation de `carry`. Validé avec l'utilisateur :
// `timeDeficit` n'est mis à jour que lors d'un kill effectif ; s'il survit ou que ses données sont
// `unavailable`, le déficit en cours reste inchangé pour l'ennemi suivant, y compris à travers les
// frontières de groupe. Retourne le résultat agrégé par entrée d'origine de wave.enemies (tué/survécu/
// raison de défaite par groupe) plus le badge de risque.
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

        const { damage: rawDamage, rate } = computeEnemyDamage(instance, duration, towers, timeDeficit);
        const damage = rawDamage + carry;
        if (damage >= instance.health) {
            instance.killed = true;
            const neededDamage = Math.max(0, instance.health - carry);
            const killTime = rate > 0 ? neededDamage / rate : 0;
            clearTime += killTime;
            timeDeficit = Math.max(0, timeDeficit + killTime - ENEMY_SPAWN_GAP_SECONDS);
            carry = (!instance.stationary && timeDeficit > 1) ? damage - instance.health : 0;
            console.log(carry, timeDeficit)
            
        } else {
            instance.killed = false;
            carry = 0;
            allKilled = false;
        }
    }
    clearTime += timeDeficit

    const waveTimerSeconds = getWaveTimerSeconds(wave.wave);
    const risk = computeWaveRisk(allKilled, clearTime, waveTimerSeconds);

    return { groups: aggregateByGroup(wave, instances, towers), clearTime, allKilled, risk, waveTimerSeconds };
}
