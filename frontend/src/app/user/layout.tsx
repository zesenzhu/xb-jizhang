import * as React from 'react';
import { UserAuthGuard } from '@/components/auth/UserAuthGuard';

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <UserAuthGuard>{children}</UserAuthGuard>;
}
