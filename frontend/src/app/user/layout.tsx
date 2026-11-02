import * as React from 'react';
import { UserNavShell } from '@/components/layout/UserNavShell';
import { UserWorkspaceProvider } from '@/components/providers/UserWorkspaceProvider';

export default function UserLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <section data-application="user">
      <UserWorkspaceProvider>
        <UserNavShell>{children}</UserNavShell>
      </UserWorkspaceProvider>
    </section>
  );
}
