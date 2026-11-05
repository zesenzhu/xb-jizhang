import * as React from 'react';
import { BillPageContent } from '@/components/bill/BillPageContent';
import { BillListSkeleton } from '@/components/skeleton/BillListSkeleton';

export default function UserHomePage(): React.JSX.Element {
  return (
    // BillPageContent 读取下钻查询参数，必须由 Suspense 包裹；骨架与真实首屏结构一致。
    <React.Suspense fallback={<BillListSkeleton />}>
      <BillPageContent />
    </React.Suspense>
  );
}
