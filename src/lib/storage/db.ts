const DB_NAME = "part-number-canvas";
const DB_VERSION = 1;
export const PROJECTS_STORE = "projects";

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Opens (and lazily creates) the single IndexedDB database this app uses.
 * The connection is cached per page load; IndexedDB itself is already
 * scoped to this origin, so there is no cross-project or cross-origin
 * leakage to guard against here.
 */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: "documentId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Resets the cached connection. Only meaningful for tests, which swap the fake IndexedDB backend between runs. */
export function _resetDbForTests(): void {
  dbPromise = null;
}

export async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return requestToPromise(store.get(key));
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return requestToPromise(store.getAll());
}

export async function dbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await requestToPromise(store.put(value));
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await requestToPromise(store.delete(key));
}

export async function dbClear(storeName: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await requestToPromise(store.clear());
}
