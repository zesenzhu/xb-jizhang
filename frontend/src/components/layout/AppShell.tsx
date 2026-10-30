import { WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <WalletCards size={19} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">小宝记账</p>
              <p className="text-xs text-slate-500">共享账本工作区</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            基础框架
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
