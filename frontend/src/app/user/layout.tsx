import * as React from 'react';
import { UserNavShell } from '@/components/layout/UserNavShell';

export default function UserLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <section data-application="user">
      <UserNavShell>{children}</UserNavShell>
    </section>
  );
}
