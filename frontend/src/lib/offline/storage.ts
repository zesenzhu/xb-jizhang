import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TransactionListResponse, TransactionSummary } from '@/lib/api/transaction-types';
import type {
  AttachmentBlobCacheRecord,
  CacheMetadataRecord,
  LocalCacheStats,
  OfflineAttachmentRecord,
  OfflineAttachmentSummaryRecord,
  OfflineTransactionRecord,
  QuerySnapshotKind,
  QuerySnapshotRecord,
} from './storage-types';

const DATABASE_NAME = 'xiaobao-jizhang-local';
const DATABASE_VERSION = 1;
export const IMAGE_CACHE_LIMIT_BYTES = 100 * 1024 * 1024;
export const TRANSACTION_SNAPSHOT_LIMIT = 500;

export function attachmentCacheKey(userId: string, ledgerId: string, attachmentId: string): string {
  return `${userId}:ledger:${ledgerId}:attachment:${attachmentId}`;
}

interface OfflineDatabase extends DBSchema {
  'transaction-outbox': {
    key: string;
    value: OfflineTransactionRecord;
    indexes: {
      'by-user': string;
      'by-user-ledger': [string, string];
    };
  };
  'attachment-outbox': {
    key: string;
    value: OfflineAttachmentRecord;
    indexes: {
      'by-user': string;
      'by-transaction': [string, string];
    };
  };
  'query-snapshots': {
    key: string;
    value: QuerySnapshotRecord;
    indexes: {
      'by-user': string;
      'by-user-ledger': [string, string];
    };
  };
  'transaction-details': {
    key: string;
    value: QuerySnapshotRecord;
    indexes: {
      'by-user': string;
    };
  };
  'attachment-summaries': {
    key: string;
    value: OfflineAttachmentSummaryRecord;
    indexes: {
      'by-user': string;
      'by-attachment': [string, string];
    };
  };
  'attachment-blobs': {
    key: string;
    value: AttachmentBlobCacheRecord;
    indexes: {
      'by-user': string;
      'by-last-accessed': string;
    };
  };
  'cache-metadata': {
    key: string;
    value: CacheMetadataRecord;
    indexes: {
      'by-user': string;
    };
  };
}

type OfflineStoreName =
  | 'transaction-outbox'
  | 'attachment-outbox'
  | 'query-snapshots'
  | 'transaction-details'
  | 'attachment-summaries'
  | 'attachment-blobs'
  | 'cache-metadata';

let databasePromise: Promise<IDBPDatabase<OfflineDatabase>> | null = null;

function getDatabase(): Promise<IDBPDatabase<OfflineDatabase>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('本地缓存只能在浏览器中使用'));
  }
  databasePromise ??= openDB<OfflineDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('transaction-outbox')) {
        const store = database.createObjectStore('transaction-outbox', { keyPath: 'localId' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-user-ledger', ['userId', 'ledgerId']);
      }
      if (!database.objectStoreNames.contains('attachment-outbox')) {
        const store = database.createObjectStore('attachment-outbox', { keyPath: 'localId' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-transaction', ['userId', 'transactionLocalId']);
      }
      if (!database.objectStoreNames.contains('query-snapshots')) {
        const store = database.createObjectStore('query-snapshots', { keyPath: 'cacheKey' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-user-ledger', ['userId', 'ledgerId']);
      }
      if (!database.objectStoreNames.contains('transaction-details')) {
        const store = database.createObjectStore('transaction-details', { keyPath: 'cacheKey' });
        store.createIndex('by-user', 'userId');
      }
      if (!database.objectStoreNames.contains('attachment-summaries')) {
        const store = database.createObjectStore('attachment-summaries', { keyPath: 'cacheKey' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-attachment', ['userId', 'attachmentId']);
      }
      if (!database.objectStoreNames.contains('attachment-blobs')) {
        const store = database.createObjectStore('attachment-blobs', { keyPath: 'cacheKey' });
        store.createIndex('by-user', 'userId');
        store.createIndex('by-last-accessed', 'lastAccessedAt');
      }
      if (!database.objectStoreNames.contains('cache-metadata')) {
        const store = database.createObjectStore('cache-metadata', { keyPath: 'cacheKey' });
        store.createIndex('by-user', 'userId');
      }
    },
  });
  return databasePromise;
}

function snapshotKey(userId: string, ledgerId: string, kind: QuerySnapshotKind): string {
  return `${userId}:ledger:${ledgerId}:${kind}`;
}

function userCacheKey(userId: string, namespace: string): string {
  return `${userId}:${namespace}`;
}

export async function enqueueOfflineTransaction(
  record: OfflineTransactionRecord,
  attachments: readonly OfflineAttachmentRecord[],
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(['transaction-outbox', 'attachment-outbox'], 'readwrite');
  transaction.objectStore('transaction-outbox').put(record);
  for (const attachment of attachments) {
    transaction.objectStore('attachment-outbox').put(attachment);
  }
  await transaction.done;
}

export async function listOfflineTransactions(
  userId: string,
  ledgerId?: string,
): Promise<OfflineTransactionRecord[]> {
  const database = await getDatabase();
  const records = ledgerId
    ? await database.getAllFromIndex('transaction-outbox', 'by-user-ledger', [userId, ledgerId])
    : await database.getAllFromIndex('transaction-outbox', 'by-user', userId);
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function listSyncableTransactions(userId: string): Promise<OfflineTransactionRecord[]> {
  const records = await listOfflineTransactions(userId);
  const syncable: OfflineTransactionRecord[] = [];
  for (const record of records) {
    if (record.status === 'PENDING' || record.status === 'FAILED') {
      syncable.push(record);
      continue;
    }
    if (record.status === 'SYNCING') {
      await updateOfflineTransaction(record.localId, { status: 'PENDING' });
      syncable.push({ ...record, status: 'PENDING' });
      continue;
    }
    if (record.status !== 'SYNCED') continue;
    const attachments = await listOfflineAttachments(userId, record.ledgerId, record.localId);
    if (attachments.some((attachment) => attachment.status !== 'ATTACHED')) syncable.push(record);
  }
  return syncable;
}

export async function updateOfflineTransaction(
  localId: string,
  patch: Partial<OfflineTransactionRecord>,
): Promise<OfflineTransactionRecord> {
  const database = await getDatabase();
  const current = await database.get('transaction-outbox', localId);
  if (!current) throw new Error('本地账单不存在');
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await database.put('transaction-outbox', next);
  return next;
}

export async function listOfflineAttachments(
  userId: string,
  ledgerId?: string,
  transactionLocalId?: string,
): Promise<OfflineAttachmentRecord[]> {
  const database = await getDatabase();
  const records = transactionLocalId
    ? await database.getAllFromIndex('attachment-outbox', 'by-transaction', [userId, transactionLocalId])
    : await database.getAllFromIndex('attachment-outbox', 'by-user', userId);
  return records
    .filter((record) => ledgerId === undefined || record.ledgerId === ledgerId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function updateOfflineAttachment(
  localId: string,
  patch: Partial<OfflineAttachmentRecord>,
): Promise<OfflineAttachmentRecord> {
  const database = await getDatabase();
  const current = await database.get('attachment-outbox', localId);
  if (!current) throw new Error('本地附件不存在');
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await database.put('attachment-outbox', next);
  return next;
}

export async function saveQuerySnapshot<T>(options: {
  userId: string;
  ledgerId: string;
  kind: QuerySnapshotKind;
  value: T;
  recordCount?: number;
}): Promise<void> {
  const database = await getDatabase();
  const record: QuerySnapshotRecord = {
    cacheKey: snapshotKey(options.userId, options.ledgerId, options.kind),
    userId: options.userId,
    ledgerId: options.ledgerId,
    kind: options.kind,
    value: options.value,
    recordCount: options.recordCount ?? 0,
    updatedAt: new Date().toISOString(),
  };
  await database.put('query-snapshots', record);
}

export async function saveRecentTransactionSnapshot(
  userId: string,
  ledgerId: string,
  response: TransactionListResponse,
): Promise<void> {
  const current = await readQuerySnapshot({
    userId,
    ledgerId,
    kind: 'transactions',
    guard: isTransactionListSnapshot,
  });
  const byId = new Map<string, TransactionSummary>();
  for (const item of current?.value.items ?? []) byId.set(item.id, item);
  for (const item of response.items) byId.set(item.id, item);
  const items = [...byId.values()]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, TRANSACTION_SNAPSHOT_LIMIT);
  await saveQuerySnapshot({
    userId,
    ledgerId,
    kind: 'transactions',
    value: {
      items,
      total: items.length,
      page: 1,
      pageSize: TRANSACTION_SNAPSHOT_LIMIT,
      hasNextPage: false,
    },
    recordCount: items.length,
  });
}

export async function readRecentTransactionSnapshot(
  userId: string,
  ledgerId: string,
): Promise<{ value: TransactionListResponse; updatedAt: string } | null> {
  return readQuerySnapshot({
    userId,
    ledgerId,
    kind: 'transactions',
    guard: isTransactionListSnapshot,
  });
}

export async function readQuerySnapshot<T>(options: {
  userId: string;
  ledgerId: string;
  kind: QuerySnapshotKind;
  guard: (value: unknown) => value is T;
}): Promise<{ value: T; updatedAt: string } | null> {
  const database = await getDatabase();
  const record = await database.get(
    'query-snapshots',
    snapshotKey(options.userId, options.ledgerId, options.kind),
  );
  if (!record || !options.guard(record.value)) return null;
  return { value: record.value, updatedAt: record.updatedAt };
}

export async function saveAttachmentSummary(
  summary: OfflineAttachmentSummaryRecord,
): Promise<void> {
  const database = await getDatabase();
  await database.put('attachment-summaries', summary);
}

export async function deleteAttachmentCache(
  userId: string,
  ledgerId: string,
  attachmentId: string,
): Promise<void> {
  const database = await getDatabase();
  const cacheKey = attachmentCacheKey(userId, ledgerId, attachmentId);
  const transaction = database.transaction(['attachment-summaries', 'attachment-blobs'], 'readwrite');
  transaction.objectStore('attachment-summaries').delete(cacheKey);
  transaction.objectStore('attachment-blobs').delete(cacheKey);
  await transaction.done;
}

export async function saveAttachmentBlob(
  record: AttachmentBlobCacheRecord,
): Promise<void> {
  const database = await getDatabase();
  const current = await database.get('attachment-blobs', record.cacheKey);
  const currentTotal = await getImageBytes(database, record.userId);
  const remaining = Math.max(0, IMAGE_CACHE_LIMIT_BYTES - currentTotal + (current?.sizeBytes ?? 0));
  if (record.sizeBytes > remaining) {
    const candidates = (await database.getAllFromIndex('attachment-blobs', 'by-user', record.userId))
      .filter((item) => item.cacheKey !== record.cacheKey)
      .sort((left, right) => left.lastAccessedAt.localeCompare(right.lastAccessedAt));
    let available = remaining;
    const transaction = database.transaction('attachment-blobs', 'readwrite');
    for (const candidate of candidates) {
      if (record.sizeBytes <= available) break;
      transaction.store.delete(candidate.cacheKey);
      available += candidate.sizeBytes;
    }
    await transaction.done;
    if (record.sizeBytes > available) return;
  }
  await database.put('attachment-blobs', record);
}

export async function readAttachmentBlob(
  userId: string,
  ledgerId: string,
  attachmentId: string,
): Promise<Blob | null> {
  const database = await getDatabase();
  const cacheKey = attachmentCacheKey(userId, ledgerId, attachmentId);
  const record = await database.get('attachment-blobs', cacheKey);
  if (!record) return null;
  await database.put('attachment-blobs', { ...record, lastAccessedAt: new Date().toISOString() });
  return record.blob;
}

async function getImageBytes(database: IDBPDatabase<OfflineDatabase>, userId: string): Promise<number> {
  const records = await database.getAllFromIndex('attachment-blobs', 'by-user', userId);
  return records.reduce((total, record) => total + record.sizeBytes, 0);
}

export async function recordLastSync(userId: string, lastSyncAt: string): Promise<void> {
  const database = await getDatabase();
  const record: CacheMetadataRecord = {
    cacheKey: userCacheKey(userId, 'sync'),
    userId,
    namespace: 'sync',
    lastSyncAt,
  };
  await database.put('cache-metadata', record);
}

export async function getLocalCacheStats(userId: string): Promise<LocalCacheStats> {
  const database = await getDatabase();
  const [blobs, snapshots, transactions, attachments, metadata] = await Promise.all([
    database.getAllFromIndex('attachment-blobs', 'by-user', userId),
    database.getAllFromIndex('query-snapshots', 'by-user', userId),
    database.getAllFromIndex('transaction-outbox', 'by-user', userId),
    database.getAllFromIndex('attachment-outbox', 'by-user', userId),
    database.get('cache-metadata', userCacheKey(userId, 'sync')),
  ]);
  return {
    imageBytes: blobs.reduce((total, blob) => total + blob.sizeBytes, 0),
    imageCount: blobs.length,
    transactionSnapshotCount: snapshots
      .filter((snapshot) => snapshot.kind === 'transactions')
      .reduce((total, snapshot) => total + snapshot.recordCount, 0),
    pendingTransactionCount: transactions.filter((transaction) => transaction.status !== 'SYNCED').length,
    pendingAttachmentCount: attachments.filter((attachment) => attachment.status !== 'ATTACHED').length,
    lastSyncAt: metadata?.lastSyncAt ?? null,
  };
}

export async function clearImageCache(userId: string): Promise<void> {
  const database = await getDatabase();
  const [blobs, summaries] = await Promise.all([
    database.getAllFromIndex('attachment-blobs', 'by-user', userId),
    database.getAllFromIndex('attachment-summaries', 'by-user', userId),
  ]);
  const transaction = database.transaction(['attachment-blobs', 'attachment-summaries'], 'readwrite');
  for (const blob of blobs) transaction.objectStore('attachment-blobs').delete(blob.cacheKey);
  for (const summary of summaries) {
    transaction.objectStore('attachment-summaries').put({
      ...summary,
      cachedAt: null,
      lastAccessedAt: null,
      cacheState: summary.status === 'DELETED' ? 'DELETED' : 'NOT_CACHED',
    });
  }
  await transaction.done;
}

export async function clearSyncedSnapshots(userId: string): Promise<void> {
  const database = await getDatabase();
  const [snapshots, details, transactions] = await Promise.all([
    database.getAllFromIndex('query-snapshots', 'by-user', userId),
    database.getAllFromIndex('transaction-details', 'by-user', userId),
    database.getAllFromIndex('transaction-outbox', 'by-user', userId),
  ]);
  const transaction = database.transaction(
    ['query-snapshots', 'transaction-details', 'transaction-outbox'],
    'readwrite',
  );
  for (const snapshot of snapshots) {
    if (snapshot.kind === 'transactions') {
      transaction.objectStore('query-snapshots').delete(snapshot.cacheKey);
    }
  }
  for (const detail of details) transaction.objectStore('transaction-details').delete(detail.cacheKey);
  for (const item of transactions) {
    if (item.status === 'SYNCED') transaction.objectStore('transaction-outbox').delete(item.localId);
  }
  await transaction.done;
}

export async function clearAllLocalData(userId: string): Promise<void> {
  const database = await getDatabase();
  const stores: OfflineStoreName[] = [
    'transaction-outbox',
    'attachment-outbox',
    'query-snapshots',
    'transaction-details',
    'attachment-summaries',
    'attachment-blobs',
    'cache-metadata',
  ];
  const records = await Promise.all(
    stores.map(async (storeName) => {
      const store = database.transaction(storeName, 'readonly').store;
      const values = await store.index('by-user').getAll(userId);
      return { storeName, values };
    }),
  );
  const transaction = database.transaction(stores, 'readwrite');
  for (const { storeName, values } of records) {
    for (const value of values) {
      const key = 'cacheKey' in value ? value.cacheKey : 'localId' in value ? value.localId : null;
      if (key) transaction.objectStore(storeName).delete(key);
    }
  }
  await transaction.done;
}

export function isTransactionListSnapshot(value: unknown): value is {
  items: TransactionSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
} {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.total === 'number' &&
    typeof candidate.page === 'number' &&
    typeof candidate.pageSize === 'number' &&
    typeof candidate.hasNextPage === 'boolean'
  );
}
