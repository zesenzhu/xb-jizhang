'use client';

import * as React from 'react';
import type { AccountListResponse } from '@/lib/api/account-types';
import type { CategoryListResponse } from '@/lib/api/category-types';
import { readQuerySnapshot, saveQuerySnapshot } from './storage';
import type { QuerySnapshotKind } from './storage-types';

export function isCategoryListResponse(value: unknown): value is CategoryListResponse {
  return isPagedList(value);
}

export function isAccountListResponse(value: unknown): value is AccountListResponse {
  return isPagedList(value);
}

function isPagedList(value: unknown): value is { items: unknown[]; total: number; page: number; pageSize: number; hasNextPage: boolean } {
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

export function useCachedLedgerSnapshot<T>(options: {
  userId: string | null;
  ledgerId: string;
  kind: QuerySnapshotKind;
  guard: (value: unknown) => value is T;
}): { data: T | null; updatedAt: string | null } {
  const { userId, ledgerId, kind, guard } = options;
  const cacheKey = `${userId ?? 'anonymous'}:${ledgerId}:${kind}`;
  const [snapshot, setSnapshot] = React.useState<{
    cacheKey: string;
    data: T;
    updatedAt: string;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!userId || !ledgerId) return () => undefined;
    void readQuerySnapshot({ userId, ledgerId, kind, guard })
      .then((value) => {
        if (!active) return;
        setSnapshot(value ? { cacheKey, data: value.value, updatedAt: value.updatedAt } : null);
      })
      .catch(() => {
        if (active) setSnapshot(null);
      });
    return () => {
      active = false;
    };
  }, [cacheKey, guard, kind, ledgerId, userId]);

  const isCurrent = snapshot?.cacheKey === cacheKey;
  return {
    data: isCurrent ? snapshot.data : null,
    updatedAt: isCurrent ? snapshot.updatedAt : null,
  };
}

export function usePersistLedgerSnapshot<T>(options: {
  userId: string | null;
  ledgerId: string;
  kind: QuerySnapshotKind;
  data: T | undefined;
  recordCount?: number;
}): void {
  const { userId, ledgerId, kind, data, recordCount } = options;
  React.useEffect(() => {
    if (!userId || !ledgerId || data === undefined) return;
    void saveQuerySnapshot({ userId, ledgerId, kind, value: data, recordCount }).catch(() => undefined);
  }, [data, kind, ledgerId, recordCount, userId]);
}
