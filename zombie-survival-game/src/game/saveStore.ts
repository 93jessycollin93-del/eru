import type { SaveMeta } from "../sim/save";

/** "auto" is written by autosave; 1-3 are the player's own slots. */
export type SlotId = "auto" | "1" | "2" | "3";
export const SLOTS: SlotId[] = ["auto", "1", "2", "3"];

export interface SlotRecord {
  slot: SlotId;
  meta: SaveMeta;
  /** The serialised SaveData. */
  data: string;
}

const DB_NAME = "zombie-survival";
const STORE = "saves";

/**
 * Save slots in IndexedDB. Each write is one transaction, so a crash mid-save
 * leaves the previous save intact. When the browser won't give us storage
 * (private windows, blocked site data) saves live in memory for the session
 * and `persistent` reports false.
 */
export class SaveStore {
  private db: Promise<IDBDatabase | null>;
  private memory = new Map<SlotId, SlotRecord>();
  persistent = true;

  constructor() {
    this.db = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "slot" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    }).then((db) => {
      if (!db) this.persistent = false;
      return db;
    });
  }

  private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db;
    if (!db) throw new Error("no database");
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("save failed"));
      tx.onabort = () => reject(tx.error ?? new Error("save aborted"));
    });
  }

  async write(record: SlotRecord): Promise<void> {
    try {
      await this.run("readwrite", (s) => s.put(record));
    } catch (e) {
      if (this.persistent && (await this.db)) throw e; // a real failure (quota): let the caller say so
      this.memory.set(record.slot, record);
    }
  }

  async read(slot: SlotId): Promise<SlotRecord | null> {
    try {
      return ((await this.run("readonly", (s) => s.get(slot))) as SlotRecord | undefined) ?? null;
    } catch {
      return this.memory.get(slot) ?? null;
    }
  }

  /** Every slot's metadata, for the load menu (without the big data strings). */
  async list(): Promise<{ slot: SlotId; meta: SaveMeta }[]> {
    let all: SlotRecord[];
    try {
      all = (await this.run("readonly", (s) => s.getAll())) as SlotRecord[];
    } catch {
      all = [...this.memory.values()];
    }
    return all.map((r) => ({ slot: r.slot, meta: r.meta })).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  }

  async remove(slot: SlotId): Promise<void> {
    this.memory.delete(slot);
    try {
      await this.run("readwrite", (s) => s.delete(slot));
    } catch {
      // Nothing stored there.
    }
  }
}
