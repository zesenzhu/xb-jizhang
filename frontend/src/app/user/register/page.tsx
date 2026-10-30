import * as React from 'react';
import { UserAuthEntry } from '@/components/auth/UserAuthEntry';

export default function UserRegisterPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<p>正在加载注册页...</p>}>
      <UserAuthEntry mode="register" />
    </React.Suspense>
  );
}
