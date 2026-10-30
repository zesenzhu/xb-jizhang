import { AdminAuthBoundary } from '@/components/auth/AdminAuthBoundary';

export default function AdminConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <AdminAuthBoundary>{children}</AdminAuthBoundary>;
}
