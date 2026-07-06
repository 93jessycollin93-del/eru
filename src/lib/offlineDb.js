/**
 * offlineDb — IndexedDB wrapper for the Bot Studio offline cache + write queue.
 * Four caches (bots, chats, messages, pods) mirror Base44 entities so the
 * studio is fully readable offline; a queue holds pending writes flushed on
 * reconnect. All ops are promise-based and degrade to no-ops if IDB is blocked.
 */

const DB_NAME = 'cybernetic67_botstudio';
const DB_VERSION = 1;
const STORES = ['bots', 'chats', 'messages', 'pods', 'queue'];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const r = fn(os);
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function idbGetAll(store) {
  try {
    const rows = await tx(store, 'readonly', (os) => os.getAll());
    return rows || [];
  } catch {
    return [];
  }
}

export async function idbGet(store, id) {
  try {
    return await tx(store, 'readonly', (os) => os.get(id));
  } catch {
    return null;
  }
}

export async function idbPut(store, val) {
  try {
    await tx(store, 'readwrite', (os) => os.put(val));
  } catch {}
  return val;
}

export async function idbBulkPut(store, vals = []) {
  if (!vals.length) return;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      vals.forEach((v) => os.put(v));
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  } catch {}
}

export async function idbDelete(store, id) {
  try {
    await tx(store, 'readwrite', (os) => os.delete(id));
  } catch {}
}

export async function idbClear(store) {
  try {
    await tx(store, 'readwrite', (os) => os.clear());
  } catch {}
}