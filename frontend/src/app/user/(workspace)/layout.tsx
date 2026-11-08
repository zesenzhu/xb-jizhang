import { UserWorkspaceAuthShell } from '@/components/auth/UserWorkspaceAuthShell';

export default function UserWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <UserWorkspaceAuthShell>{children}</UserWorkspaceAuthShell>;
}
