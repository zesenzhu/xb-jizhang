/**
 * 本地皮肤图片存储。
 *
 * 只用 IndexedDB，不发请求、不进 localStorage：
 * localStorage 只有 5MB 且以字符串存，图片转 base64 会再膨胀 33%，容易写爆。
 * 这里刻意不引入任何 API 调用，图片永远留在本机。
 */

const DATABASE_NAME = 'jizhang-skin';
const STORE_NAME = 'images';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地图片库'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = run(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('本地图片操作失败'));
        transaction.oncomplete = () => database.close();
      }),
  );
}

export function isLocalImageStorageSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** 存一张图片，返回可直接使用的键；键由调用方生成，便于切换皮肤时整体替换。 */
export async function putSkinImage(key: string, blob: Blob): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(blob, key));
}

export async function getSkinImage(key: string): Promise<Blob | null> {
  if (!isLocalImageStorageSupported()) return null;
  const value = await runTransaction<Blob | undefined>('readonly', (store) => store.get(key));
  return value ?? null;
}

export async function deleteSkinImage(key: string): Promise<void> {
  if (!isLocalImageStorageSupported()) return;
  await runTransaction('readwrite', (store) => store.delete(key));
}

/** 生成新的图片键；切换图片时旧键会被删除，避免本地残留。 */
export function createSkinImageKey(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `summary-${Date.now()}-${random}`;
}
