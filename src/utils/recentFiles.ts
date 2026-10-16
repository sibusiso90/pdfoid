/**
 * Recent documents and autosave, kept in this browser's IndexedDB. Each entry
 * holds the latest working bytes so a document can be reopened where it was left.
 */

export interface RecentFileMeta {
  id: string
  name: string
  size: number
  updatedAt: number
}

interface RecentFileRecord extends RecentFileMeta {
  bytes: Uint8Array
}

export const MAX_RECENT_FILES = 8
/** Larger files are not stored, to stay well inside browser storage quotas. */
export const MAX_RECENT_FILE_BYTES = 50 * 1024 * 1024

const DB_NAME = 'pdfoid-recent'
const STORE = 'files'

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const openDb = () => {
  const req = indexedDB.open(DB_NAME, 1)
  req.onupgradeneeded = () => {
    const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
    store.createIndex('updatedAt', 'updatedAt')
  }
  return request(req)
}

const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    const result = await fn(tx.objectStore(STORE))
    await done
    return result
  } finally {
    db.close()
  }
}

/** Saves (or updates) a document. Returns false if it is too large to keep. */
export async function saveRecent(entry: { id: string; name: string; bytes: Uint8Array; updatedAt?: number }): Promise<boolean> {
  if (entry.bytes.byteLength > MAX_RECENT_FILE_BYTES) return false
  const record: RecentFileRecord = {
    id: entry.id,
    name: entry.name,
    bytes: entry.bytes.slice(),
    size: entry.bytes.byteLength,
    updatedAt: entry.updatedAt ?? Date.now(),
  }
  await withStore('readwrite', async (store) => {
    await request(store.put(record))
    // Evict the oldest entries beyond the limit.
    const keys = await request(store.index('updatedAt').getAllKeys())
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_RECENT_FILES))) await request(store.delete(key))
  })
  return true
}

/** Newest first, without the document bytes. */
export async function listRecent(): Promise<RecentFileMeta[]> {
  const records = await withStore('readonly', (store) => request(store.getAll() as IDBRequest<RecentFileRecord[]>))
  return records
    .map(({ id, name, size, updatedAt }) => ({ id, name, size, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadRecent(id: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  const record = await withStore('readonly', (store) => request(store.get(id) as IDBRequest<RecentFileRecord | undefined>))
  return record ? { name: record.name, bytes: new Uint8Array(record.bytes) } : null
}

export async function removeRecent(id: string): Promise<void> {
  await withStore('readwrite', (store) => request(store.delete(id)))
}
