import { AppShell } from '@/components/layout/AppShell';
import { FoundationDashboard } from '@/components/FoundationDashboard';

export default function HomePage(): React.JSX.Element {
  return (
    <AppShell>
      <FoundationDashboard />
    </AppShell>
  );
}
