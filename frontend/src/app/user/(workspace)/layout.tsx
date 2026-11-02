import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';
import { UserHomeSkeleton } from '@/components/auth/UserHomeSkeleton';

export default function UserWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <UserAuthBoundary fallback={<UserHomeSkeleton />}>{children}</UserAuthBoundary>;
}
