import * as React from 'react';
import { LedgerManagePage } from '@/components/ledger/LedgerManagePage';
import { LedgerListSkeleton } from '@/components/skeleton/LedgerListSkeleton';

export default function UserLedgersPage(): React.JSX.Element {
  // LedgerManagePage 读取 `?create=1` 自动打开创建面板，必须由 Suspense 包裹。
  return (
    <React.Suspense fallback={<LedgerListSkeleton />}>
      <LedgerManagePage />
    </React.Suspense>
  );
}
