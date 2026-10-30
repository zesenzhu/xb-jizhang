import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';

export default function UserWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <UserAuthBoundary>{children}</UserAuthBoundary>;
}
