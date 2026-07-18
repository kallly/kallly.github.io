// Service de collaboration en temps réel, basé sur Firebase Realtime Database.
// Ce module ne connaît que Firebase : il ne touche jamais directement aux
// modèles de l'application (voir collabController.js pour la colle).
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
    getDatabase,
    ref,
    get,
    set,
    update,
    remove,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onValue,
    off
} from "firebase/database";
import { firebaseConfig } from "../config/firebaseConfig.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I...)

let app = null;
let auth = null;
let db = null;
let currentRoomCode = null;

const remoteCallbacks = {
    onTroopAdded: null,
    onTroopChanged: null,
    onTroopRemoved: null,
    onMapChanged: null
};

// Initialise Firebase et authentifie l'utilisateur de façon anonyme.
// Doit être appelé une seule fois, avant createSession/joinSession.
export async function initCollab() {
    if (app) {
        return;
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    await signInAnonymously(auth);
}

function generateRoomCode(length = 6) {
    let code = "";
    for (let i = 0; i < length; i += 1) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    return code;
}

function sessionRef(roomCode) {
    return ref(db, `sessions/${roomCode}`);
}

// Vérifie qu'une room existe déjà.
export async function sessionExists(roomCode) {
    const snapshot = await get(sessionRef(roomCode));
    return snapshot.exists();
}

// Attache les écouteurs temps réel sur la room courante.
function attachListeners(roomCode) {
    const troopsRef = ref(db, `sessions/${roomCode}/troops`);
    const mapRef = ref(db, `sessions/${roomCode}/mapName`);

    onChildAdded(troopsRef, (snapshot) => {
        remoteCallbacks.onTroopAdded?.(snapshot.key, snapshot.val());
    });
    onChildChanged(troopsRef, (snapshot) => {
        remoteCallbacks.onTroopChanged?.(snapshot.key, snapshot.val());
    });
    onChildRemoved(troopsRef, (snapshot) => {
        remoteCallbacks.onTroopRemoved?.(snapshot.key);
    });
    onValue(mapRef, (snapshot) => {
        if (snapshot.exists()) {
            remoteCallbacks.onMapChanged?.(snapshot.val());
        }
    });
}

function detachListeners(roomCode) {
    off(ref(db, `sessions/${roomCode}/troops`));
    off(ref(db, `sessions/${roomCode}/mapName`));
}

// Crée une nouvelle session à partir de l'état local actuel et retourne son code.
// payload: { mapName, troops: { [id]: { troop, level, x, y, color } } }
export async function createSession(payload) {
    let code = generateRoomCode();
    while (await sessionExists(code)) {
        code = generateRoomCode();
    }

    await set(sessionRef(code), {
        mapName: payload.mapName || null,
        troops: payload.troops || {}
    });

    currentRoomCode = code;
    attachListeners(code);
    return code;
}

// Rejoint une session existante (l'existence doit avoir été vérifiée via sessionExists).
export function joinSession(roomCode) {
    currentRoomCode = roomCode;
    attachListeners(roomCode);
}

// Quitte la session courante : détache les écouteurs, ne supprime pas la room côté serveur.
export function leaveSession() {
    if (!currentRoomCode) {
        return;
    }
    detachListeners(currentRoomCode);
    currentRoomCode = null;
}

export function getRoomCode() {
    return currentRoomCode;
}

export function isSessionActive() {
    return currentRoomCode !== null;
}

export function pushTroopAdd(id, data) {
    if (!currentRoomCode) {
        return;
    }
    set(ref(db, `sessions/${currentRoomCode}/troops/${id}`), data);
}

export function pushTroopUpdate(id, updates) {
    if (!currentRoomCode) {
        return;
    }
    update(ref(db, `sessions/${currentRoomCode}/troops/${id}`), updates);
}

export function pushTroopRemove(id) {
    if (!currentRoomCode) {
        return;
    }
    remove(ref(db, `sessions/${currentRoomCode}/troops/${id}`));
}

export function pushMapChange(mapName) {
    if (!currentRoomCode) {
        return;
    }
    set(ref(db, `sessions/${currentRoomCode}/mapName`), mapName);
}

// Supprime toutes les troupes de la room courante (équivalent réseau de "Vider la carte").
export function pushClearAll() {
    if (!currentRoomCode) {
        return;
    }
    set(ref(db, `sessions/${currentRoomCode}/troops`), {});
}

export function onRemoteTroopAdded(callback) {
    remoteCallbacks.onTroopAdded = callback;
}

export function onRemoteTroopChanged(callback) {
    remoteCallbacks.onTroopChanged = callback;
}

export function onRemoteTroopRemoved(callback) {
    remoteCallbacks.onTroopRemoved = callback;
}

export function onRemoteMapChanged(callback) {
    remoteCallbacks.onMapChanged = callback;
}
