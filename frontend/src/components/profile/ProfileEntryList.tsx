'use client';

import * as React from 'react';
import { User, Shield, Mail, HelpCircle, ChevronRight, Palette, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProfileEntry {
  key: string;
  label: string;
  description?: string;
  badge?: string;
  icon: 'user' | 'shield' | 'mail' | 'help' | 'palette' | 'database';
  onClick: () => void;
}

export interface ProfileEntryListProps {
  entries: readonly ProfileEntry[];
}

const ICON_MAP = {
  user: User,
  shield: Shield,
  mail: Mail,
  help: HelpCircle,
  palette: Palette,
  database: Database,
} as const;

export function ProfileEntryList({ entries }: ProfileEntryListProps): React.JSX.Element {
  return (
    <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
      {entries.map((entry) => {
        const IconComponent = ICON_MAP[entry.icon] ?? User;

        return (
          <button
            key={entry.key}
            type="button"
            onClick={entry.onClick}
            className={cn(
              'w-full flex items-center justify-between p-4 text-left transition-colors',
              'hover:bg-app-card-subtle active:bg-app-card-subtle/80',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
            )}
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconComponent className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-main truncate">
                  {entry.label}
                </div>
                {entry.description && (
                  <div className="text-xs text-text-tertiary truncate">
                    {entry.description}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {entry.badge && (
                <Badge
                  variant="destructive"
                  className="rounded-full px-2 py-0 text-xs font-semibold"
                >
                  {entry.badge}
                </Badge>
              )}
              <ChevronRight className="size-4 text-text-tertiary" aria-hidden="true" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
