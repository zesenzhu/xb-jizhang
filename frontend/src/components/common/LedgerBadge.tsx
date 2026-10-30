import * as React from 'react';
import { ShieldAlert, ShieldCheck, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type LedgerType = 'PERSONAL' | 'SHARED';
export type LedgerRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface LedgerBadgeProps {
  type?: LedgerType;
  role?: LedgerRole;
  showIcon?: boolean;
  className?: string;
}

export function LedgerBadge({
  type,
  role,
  showIcon = true,
  className,
}: LedgerBadgeProps): React.JSX.Element {
  if (type) {
    const isPersonal = type === 'PERSONAL';
    return (
      <Badge
        variant="secondary"
        className={cn(
          'gap-1 font-normal',
          isPersonal ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700 border-blue-200/50',
          className,
        )}
      >
        {showIcon && (isPersonal ? <User size={12} aria-hidden="true" /> : <Users size={12} aria-hidden="true" />)}
        <span>{isPersonal ? '个人账本' : '共享账本'}</span>
      </Badge>
    );
  }

  if (role) {
    const roleConfig = {
      OWNER: {
        text: '所有者',
        variant: 'success' as const,
        icon: <ShieldAlert size={12} aria-hidden="true" />,
      },
      EDITOR: {
        text: '记账协作',
        variant: 'secondary' as const,
        icon: <ShieldCheck size={12} aria-hidden="true" />,
      },
      VIEWER: {
        text: '只读观察',
        variant: 'outline' as const,
        icon: <User size={12} aria-hidden="true" />,
      },
    };

    const config = roleConfig[role];
    return (
      <Badge variant={config.variant} className={cn('gap-1', className)}>
        {showIcon && config.icon}
        <span>{config.text}</span>
      </Badge>
    );
  }

  return <></>;
}

