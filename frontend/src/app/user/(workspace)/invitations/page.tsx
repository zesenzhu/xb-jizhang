import * as React from 'react';
import { MyInvitationsPage } from '@/components/invitation/MyInvitationsPage';
import { SecondaryPageSkeleton } from '@/components/skeleton/SecondaryPageSkeleton';

export default function UserInvitationsPage(): React.JSX.Element {
  // 页面读取 `?token=` 处理接受/拒绝，必须由 Suspense 包裹。
  return (
    <React.Suspense fallback={<SecondaryPageSkeleton title="我的邀请" subtitle="用户工作区" />}>
      <MyInvitationsPage />
    </React.Suspense>
  );
}
