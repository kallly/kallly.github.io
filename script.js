// =====================================
// TDS Placement Editor
// Initialisation
// =====================================

// Canvas
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Interface
const troopList = document.getElementById("troopList");
const levelSelect = document.getElementById("level");

const selectedTroopText = document.getElementById("selectedTroop");
const selectedRangeText = document.getElementById("selectedRange");
const selectedCollisionText = document.getElementById("selectedCollision");

const jsonArea = document.getElementById("jsonArea");

const troopSearch = document.getElementById("troopSearch");
const troopColor = document.getElementById("troopColor");
// =====================================
// Carte
// =====================================

const mapImage = new Image();
mapImage.src = "images/Wretched_Front.webp";

// =====================================
// Caméra
// =====================================

const camera = {

    x: 0,
    y: 0,

    zoom: 1,

    dragging: false,

    lastMouseX: 0,
    lastMouseY: 0

};

// =====================================
// Souris
// =====================================

const mouse = {

    x: 0,
    y: 0,

    worldX: 0,
    worldY: 0

};

// =====================================
// Données
// =====================================

let selectedTroop = null;

let selectedPlacedTroop = null;

const placedTroops = [];

let showRanges = true;

let mapScale = 1;
let mapX = 0;
let mapY = 0;

let TROOPS = {};

let rangeMapMult = 14;
let collisionMapMult = 20;

let troopColors = {};

async function loadTroopsData(){

    const response = await fetch("data/troops.json");
    for(const troopName in TROOPS){
        troopColors[troopName] = "#FFD54A";
    }
    TROOPS = await response.json();

    console.log("Troupes chargées :", TROOPS);


    buildTroopMenu();

    updateSelectedTroopPanel();

}


loadTroopsData();

// =====================================
// Création du menu
// =====================================

function buildTroopMenu(search = "") {

    troopList.innerHTML = "";

    search = search.toLowerCase();


    for (const troopName in TROOPS) {


        // Filtre recherche
        if(
            !troopName
            .toLowerCase()
            .includes(search)
        ){
            continue;
        }


        const button = document.createElement("button");

        button.className = "troopButton";

        button.textContent = troopName;


        button.onclick = () => {


            selectedTroop = troopName;
            troopColor.value = troopColors[troopName];

            updateTroopButtons();

            updateSelectedTroopPanel();
            
            updateCursor();

        };


        troopList.appendChild(button);

    }


    updateTroopButtons();

}

troopSearch.addEventListener(
    "input",
    () => {

        buildTroopMenu(
            troopSearch.value
        );

    }
);

troopColor.addEventListener(
    "input",
    ()=>{
        if(!selectedTroop)
            return;

        const color = troopColor.value;
        
        // Change la couleur du type
        troopColors[selectedTroop] = color;

        // Change toutes les troupes déjà posées
        for(const troop of placedTroops){
            if(troop.troop === selectedTroop){
                troop.color = color;
            }
        }
});

function updateTroopButtons() {

    const buttons = troopList.querySelectorAll("button");

    buttons.forEach(button => {

        if (button.textContent === selectedTroop) {

            button.classList.add("selected");

        } else {

            button.classList.remove("selected");

        }

    });

}

// =====================================
// Informations de la troupe sélectionnée
// =====================================

function updateSelectedTroopPanel() {

    if (selectedTroop == null) {

        selectedTroopText.textContent = "Aucune";

        selectedRangeText.textContent = "-";

        selectedCollisionText.textContent = "-";

        return;

    }

    const troop = TROOPS[selectedTroop];

    const level = Number(levelSelect.value);

    const range =
        rangeMapMult *
        troop.rangeMultiplier[level];

    selectedTroopText.textContent = selectedTroop;

    selectedRangeText.textContent =
        range.toFixed(2);

    selectedCollisionText.textContent =
        troop.collision;

}

// =====================================
// Changement de niveau
// =====================================

levelSelect.addEventListener("change", () => {

    // Mise à jour du menu de placement
    updateSelectedTroopPanel();


    // Modification de la troupe sélectionnée
    if(selectedPlacedTroop){

        const newLevel = Number(levelSelect.value);

        selectedPlacedTroop.level = newLevel;


        selectedPlacedTroop.range =
            getTroopRange(
                selectedPlacedTroop.troop,
                newLevel
            );


        updateSelectedPlacedPanel();

    }

});

// =====================================
// Conversion écran -> monde
// =====================================

function screenToWorld(x, y){

    return {

        x: (x - mapX) / mapScale,

        y: (y - mapY) / mapScale

    };

}

// =====================================
// Position souris
// =====================================

canvas.addEventListener("mousemove", (event) => {

    const rect = canvas.getBoundingClientRect();

    mouse.x = event.clientX - rect.left;

    mouse.y = event.clientY - rect.top;

    const world = screenToWorld(mouse.x, mouse.y);

    mouse.worldX = world.x;

    mouse.worldY = world.y;

});

// =====================================
// Chargement de la carte
// =====================================

mapImage.onload = () => {

    const availableWidth = canvas.width;
    const availableHeight = canvas.height;

    const scaleX = availableWidth / mapImage.width;
    const scaleY = availableHeight / mapImage.height;

    mapScale = Math.min(scaleX, scaleY);

    mapOffsetX = (availableWidth - mapImage.width * mapScale) / 2;
    mapOffsetY = (availableHeight - mapImage.height * mapScale) / 2;

};


// =====================================
// Initialisation
// =====================================

function resizeCanvas() {

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();


console.log("Initialisation terminée.");

// =====================================
// Placement
// =====================================

// Retourne la portée d'une troupe à un niveau
function getTroopRange(troopName, level) {

    const troop = TROOPS[troopName];
    if (level >= troop.rangeMultiplier.length) {
        return rangeMapMult * troop.rangeMultiplier[troop.rangeMultiplier.length-1];
    }
    return rangeMapMult * troop.rangeMultiplier[level];

}

function getTroopSize(troopName) {

    const troop = TROOPS[troopName];

    return collisionMapMult * troop.collision;

}

// Vérifie si une position est libre
function canPlaceTroop(x, y) {

    if (selectedTroop == null)
        return false;

    const troop = TROOPS[selectedTroop];

    for (const placed of placedTroops) {

        const dx = x - placed.x;
        const dy = y - placed.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < getTroopSize(selectedTroop) + getTroopSize(placed.troop)) {

            return false;

        }

    }

    return true;

}

// Cherche une troupe sous la souris
function getTroopAt(x, y) {

    for (let i = placedTroops.length - 1; i >= 0; i--) {

        const troop = placedTroops[i];

        const dx = x - troop.x;
        const dy = y - troop.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= troop.collision) {

            return troop;

        }

    }

    return null;

}

const toggleRangeButton = document.getElementById("toggleRange");

toggleRangeButton.onclick = () => {

    showRanges = !showRanges;

    toggleRangeButton.textContent =
        showRanges
        ? "Masquer les portées"
        : "Afficher les portées";

};

// =====================================
// Placement / Sélection
// =====================================

function updateSelectedPlacedPanel(){

    if(!selectedPlacedTroop)
        return;


    selectedTroopText.textContent =
        selectedPlacedTroop.troop;


    selectedRangeText.textContent =
        selectedPlacedTroop.range.toFixed(1);


    selectedCollisionText.textContent = selectedPlacedTroop.collision;

}

canvas.addEventListener("click", () => {

    // Clique sur une troupe déjà placée
    const clickedTroop = getTroopAt(mouse.worldX, mouse.worldY);

    if (clickedTroop) {
        selectedPlacedTroop = clickedTroop;

        // Affiche son niveau actuel
        levelSelect.value =
            clickedTroop.level;

        updateSelectedPlacedPanel();

        return;
    }

    // Aucune troupe choisie
    if (selectedTroop == null){
        unselectTroop();
        return;
    }
    
    // Position invalide
    if (!canPlaceTroop(mouse.worldX, mouse.worldY))
        return;

    const troopData = TROOPS[selectedTroop];

    const level = Number(levelSelect.value);

    placedTroops.push({

        troop: selectedTroop,

        level: level,

        x: mouse.worldX,

        y: mouse.worldY,

        collision: getTroopSize(selectedTroop),

        range: getTroopRange(selectedTroop, level),
        color: troopColors[selectedTroop],

    });

    selectedPlacedTroop = placedTroops[placedTroops.length - 1];

});

// =====================================
// Suppression
// =====================================

document
.getElementById("deleteSelected")
.onclick = () => {

    if (selectedPlacedTroop == null)
        return;

    const index = placedTroops.indexOf(selectedPlacedTroop);

    if (index !== -1) {

        placedTroops.splice(index, 1);

    }

    selectedPlacedTroop = null;

};

// =====================================
// Vider la carte
// =====================================

document
.getElementById("clearMap")
.onclick = () => {

    placedTroops.length = 0;

    selectedPlacedTroop = null;

};

// =====================================
// Aperçu du placement
// =====================================

function drawPlacementPreview() {

    if (selectedTroop == null)
        return;

    const troop = TROOPS[selectedTroop];

    const level = Number(levelSelect.value);

    const range = getTroopRange(selectedTroop, level);
    const collision = getTroopSize(selectedTroop);

    const valid = canPlaceTroop(
        mouse.worldX,
        mouse.worldY
    );

    // Cercle de portée
    ctx.beginPath();

    const x = mapX + mouse.worldX * mapScale;
    const y = mapY + mouse.worldY * mapScale;
    ctx.arc(x, y, range * mapScale, 0, Math.PI * 2);

    ctx.fillStyle = valid
        ? "rgba(0,255,0,0.18)"
        : "rgba(255,0,0,0.18)";

    ctx.fill();

    ctx.lineWidth = 2;

    ctx.strokeStyle = valid
        ? "#00ff00"
        : "#ff4444";

    ctx.stroke();

    // Cercle de collision
    ctx.beginPath();
    ctx.arc(x, y, collision * mapScale, 0, Math.PI * 2);

    ctx.fillStyle = valid
        ? "#00cc00"
        : "#ff3333";

    ctx.fill();

}

// =====================================
// Rendu
// =====================================

// Dessine la carte
function drawMap() {

    if (!mapImage.complete) return;

    mapScale = Math.min(
        canvas.width / mapImage.width,
        canvas.height / mapImage.height
    );

    const drawWidth = mapImage.width * mapScale;
    const drawHeight = mapImage.height * mapScale;

    mapX = (canvas.width - drawWidth) / 2;
    mapY = (canvas.height - drawHeight) / 2;

    ctx.drawImage(
        mapImage,
        mapX,
        mapY,
        drawWidth,
        drawHeight
    );
}

// Dessine une troupe
function drawTroop(troop) {

    // Cercle de portée
    if(showRanges){
        ctx.beginPath();

        ctx.arc(
        mapX + troop.x * mapScale,
        mapY + troop.y * mapScale,
        troop.range * mapScale,
        0,
        Math.PI * 2
        );

        ctx.fillStyle = "rgba(0,170,255,0.15)";
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#00BFFF";
        ctx.stroke();
    }

    // Cercle de collision
    ctx.beginPath();

    ctx.arc(
    mapX + troop.x * mapScale,
    mapY + troop.y * mapScale,
    troop.collision * mapScale,
    0,
    Math.PI * 2
    );

    ctx.fillStyle = troopColors[troop.troop] ||troop.color || "#FFD54A";
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#222";
    ctx.stroke();

    const drawX = mapX + troop.x * mapScale;
    const drawY = mapY + troop.y * mapScale;
    // Nom
    ctx.fillStyle = "white";
    ctx.font = `bold ${16 * mapScale}px Arial`;
    ctx.textAlign = "center";
    
    ctx.fillText(
        troop.troop,
        drawX,
        drawY - troop.collision * mapScale - 8
    );
    
    ctx.fillStyle = "black";
    ctx.font = `bold ${13 * mapScale}px Arial`;
    
    ctx.fillText(
        "L" + troop.level,
        drawX,
        drawY + 4 * mapScale
    );

}

// Dessine la sélection
function drawSelection() {

    if (selectedPlacedTroop == null)
        return;

    ctx.beginPath();

    ctx.arc(

        mapX +  selectedPlacedTroop.x * mapScale,
        mapY + selectedPlacedTroop.y * mapScale,

        selectedPlacedTroop.collision * mapScale + 5,

        0,

        Math.PI * 2

    );

    ctx.lineWidth = 3;

    ctx.strokeStyle = "#00FF00";

    ctx.stroke();

}

// Dessine toutes les troupes
function drawTroops() {

    for (const troop of placedTroops) {

        drawTroop(troop);

    }

}

// =====================================
// Boucle de rendu
// =====================================

function render() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.save();

    // Caméra
    ctx.scale(
        camera.zoom,
        camera.zoom
    );

    ctx.translate(
        -camera.x,
        -camera.y
    );

    // Carte
    drawMap();

    // Troupes
    drawTroops();

    // Sélection
    drawSelection();

    // Aperçu de placement
    drawPlacementPreview();

    ctx.restore();

    requestAnimationFrame(render);

}

// =====================================
// Sortie du mode placement (clic droit)
// =====================================

function unselectTroop() {

    event.preventDefault();

    // Quitte le mode placement
    selectedTroop = null;

    // Déséléctionne la troupe sélectionnée
    selectedPlacedTroop = null;

    updateTroopButtons();

    updateSelectedTroopPanel();
}

canvas.addEventListener("contextmenu", (event) => {
    unselectTroop();
});

// Lancement de la boucle
render();

// =====================================
// Sauvegarde / Chargement
// =====================================

const saveButton = document.getElementById("saveMap");
const loadButton = document.getElementById("loadMap");

// Export JSON
saveButton.onclick = () => {

    const save = {

        version: 1,

        troops: []

    };

    for (const troop of placedTroops) {

        save.troops.push({

            troop: troop.troop,

            level: troop.level,

            x: Math.round(troop.x),

            y: Math.round(troop.y),
            
            color: troop.color,

        });

    }

    jsonArea.value = JSON.stringify(
        save,
        null,
        4
    );

};

// Import JSON
loadButton.onclick = () => {

    try {

        const save = JSON.parse(jsonArea.value);

        placedTroops.length = 0;

        if (!save.troops)
            return;

        for (const data of save.troops) {

            if (!TROOPS[data.troop])
                continue;

            const troop = TROOPS[data.troop];

            placedTroops.push({

                troop: data.troop,

                level: data.level,

                x: data.x,

                y: data.y,

                collision: getTroopSize(data.troop),

                range: getTroopRange(
                    data.troop,
                    data.level
                ),
                color: troopColors[selectedTroop],

            });

        }

        selectedPlacedTroop = null;

        alert("Carte chargée.");

    }
    catch (e) {

        alert("JSON invalide.");
        console.error(e);

    }

};

// =====================================
// Raccourcis clavier
// =====================================

document.addEventListener("keydown", (event) => {

    // Supprimer la troupe sélectionnée
    if (event.key === "Delete") {

        if (!selectedPlacedTroop)
            return;

        const index =
            placedTroops.indexOf(
                selectedPlacedTroop
            );

        if (index !== -1) {

            placedTroops.splice(index, 1);

        }

        selectedPlacedTroop = null;

    }

    // Sauvegarde rapide (CTRL+S)
    if (event.ctrlKey && event.key === "s") {

        event.preventDefault();

        saveButton.click();

    }

    // Chargement rapide (CTRL+L)
    if (event.ctrlKey && event.key === "l") {

        event.preventDefault();

        loadButton.click();

    }

});

// =====================================
// Fonctions utilitaires
// =====================================

function exportMap() {

    saveButton.click();

}

function importMap(json) {

    jsonArea.value = json;

    loadButton.click();

}

console.log("Sauvegarde prête.");