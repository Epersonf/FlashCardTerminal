// ------------------------------------------------------------
// Camada de persistência: IndexedDB + File System Access API
// ------------------------------------------------------------
const DB_NAME = 'FCT_Database';
const STORE_STATE = 'app_state';
const STORE_HANDLES = 'file_handles';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
      if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Estado central
async function loadStateFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, 'readonly');
    const req = tx.objectStore(STORE_STATE).get('main_data');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveStateToDB(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, 'readwrite');
    tx.objectStore(STORE_STATE).put(data, 'main_data');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// File System Access API — handle persistido entre sessões
async function rememberDataFile(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    tx.objectStore(STORE_HANDLES).put(handle, 'data_file');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadRememberedDataFile() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readonly');
    const req = tx.objectStore(STORE_HANDLES).get('data_file');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Helpers do File System Access API
async function hasFilePermission(handle) {
  if (!handle || !handle.queryPermission) return false;
  return await handle.queryPermission({ mode: 'readwrite' }) === 'granted';
}

function validateData(p) {
  if (!p || !Array.isArray(p.subjects) || !Array.isArray(p.cards))
    throw new Error('formato invalido');
}

async function readDataFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return DEF; // DEF definido em utils.js — disponível no escopo global
  const parsed = JSON.parse(text);
  validateData(parsed);
  return normalizeData(parsed); // normalizeData definido em utils.js
}

async function writeDataFile(handle, d) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(d, null, 2));
  await writable.close();
}
