/**
 * botStudioStore — single data-access layer for the Offline AI Studio.
 * ----------------------------------------------------------------------------
 * Mirrors the mediaLibrary pattern: UI never touches the Base44 SDK directly.
 *
 * Strategy:
 *  - Online: writes go to Base44 (cloud) AND the IndexedDB cache (source of
 *    truth for the UI). Reads come from cache; pullCloud() refreshes cache.
 *  - Offline: writes go to cache + a queue; flushQueue() replays them to the
 *    cloud on reconnect. Temp ids are reconciled when the cloud create lands.
 *
 * This makes the studio fully usable offline and fully persisted online.
 */

import { base44 } from '@/api/base44Client';
import * as idb from './offlineDb';

const SCHEMA = [
  { key: 'bots', entity: 'OfflineBot', sort: '-updated_date' },
  { key: 'chats', entity: 'BotChat', sort: '-updated_date' },
  { key: 'messages', entity: 'BotMessage', sort: '-timestamp' },
  { key: 'pods', entity: 'MemoryPod', sort: '-updated_date' },
];

const online = () => typeof navigator !== 'undefined' && navigator.onLine;
const cfg = (key) => SCHEMA.find((s) => s.key === key);

export function getLastSync() {
  try {
    return localStorage.getItem('botstudio_last_sync');
  } catch {
    return null;
  }
}

/** Full cloud → cache refresh. Returns null when offline. */
export async function pullCloud() {
  if (!online()) return null;
  const results = {};
  await Promise.all(
    SCHEMA.map(async (s) => {
      const rows = await base44.entities[s.entity].list(s.sort, 1000).catch(() => []);
      results[s.key] = rows || [];
      await idb.idbClear(s.key);
      await idb.idbBulkPut(s.key, rows || []);
    }),
  );
  try {
    localStorage.setItem('botstudio_last_sync', new Date().toISOString());
  } catch {}
  return results;
}

async function queueOp(op) {
  await idb.idbPut('queue', op);
}

/** Replay pending writes to the cloud. Stops on first error (preserves order). */
export async function flushQueue() {
  const q = (await idb.idbGetAll('queue')) || [];
  q.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const op of q) {
    const s = cfg(op.store);
    if (!s) continue;
    try {
      if (op.type === 'create') {
        const created = await base44.entities[s.entity].create(op.data);
        const cached = await idb.idbGet(op.store, op.tempId);
        if (cached) {
          await idb.idbDelete(op.store, op.tempId);
          await idb.idbPut(op.store, { ...cached, ...created, id: created.id });
          // Re-link children that still point at the temp id.
          if (op.store === 'bots') {
            const chats = (await idb.idbGetAll('chats')) || [];
            for (const c of chats) {
              if (c.bot_id === op.tempId) {
                await idb.idbPut('chats', { ...c, bot_id: created.id });
              }
            }
          } else if (op.store === 'chats') {
            const msgs = (await idb.idbGetAll('messages')) || [];
            for (const m of msgs) {
              if (m.chat_id === op.tempId) {
                await idb.idbPut('messages', { ...m, chat_id: created.id });
              }
            }
          }
        }
      } else if (op.type === 'update') {
        await base44.entities[s.entity].update(op.id, op.data);
      } else if (op.type === 'delete') {
        await base44.entities[s.entity].delete(op.id);
      }
      await idb.idbDelete('queue', op.id);
    } catch (err) {
      throw err;
    }
  }
}

export async function syncNow() {
  if (!online()) throw new Error('Offline — reconnect to sync.');
  await flushQueue();
  return pullCloud();
}

// ---- Reads (cache) ----
export const listAll = (key) => idb.idbGetAll(key);
export const getOne = (key, id) => idb.idbGet(key, id);

// ---- Writes ----
export async function createRow(store, data) {
  const s = cfg(store);
  if (online()) {
    try {
      const created = await base44.entities[s.entity].create(data);
      await idb.idbPut(store, created);
      return created;
    } catch {
      /* fall through to offline queue */
    }
  }
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row = { ...data, id: tempId, _pending: true };
  await idb.idbPut(store, row);
  await queueOp({ id: tempId, store, type: 'create', data, tempId, ts: Date.now() });
  return row;
}

export async function updateRow(store, id, patch) {
  const s = cfg(store);
  const existing = await idb.idbGet(store, id);
  const merged = { ...(existing || {}), ...patch, id };
  await idb.idbPut(store, merged);
  if (String(id).startsWith('temp_')) {
    // Pending create — patch the queued data so the eventual cloud create is correct.
    const { id: _omitId, _pending: _omitP, ...cleanExisting } = existing || {};
    const { id: _omitId2, _pending: _omitP2, ...cleanPatch } = patch || {};
    await queueOp({ id, store, type: 'create', data: { ...cleanExisting, ...cleanPatch }, tempId: id, ts: Date.now() });
    return merged;
  }
  if (online()) {
    try {
      await base44.entities[s.entity].update(id, patch);
    } catch {
      await queueOp({ id, store, type: 'update', data: patch, ts: Date.now() });
    }
  } else {
    await queueOp({ id, store, type: 'update', data: patch, ts: Date.now() });
  }
  return merged;
}

export async function deleteRow(store, id) {
  await idb.idbDelete(store, id);
  await idb.idbDelete('queue', id);
  if (String(id).startsWith('temp_')) return; // never reached the cloud
  const s = cfg(store);
  if (online()) {
    try {
      await base44.entities[s.entity].delete(id);
    } catch {
      await queueOp({ id, store, type: 'delete', data: null, ts: Date.now() });
    }
  } else {
    await queueOp({ id, store, type: 'delete', data: null, ts: Date.now() });
  }
}