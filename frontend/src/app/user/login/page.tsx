import * as React from 'react';
import { UserAuthEntry } from '@/components/auth/UserAuthEntry';

export default function UserLoginPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<p>正在加载登录页...</p>}>
      <UserAuthEntry mode="login" />
    </React.Suspense>
  );
}
