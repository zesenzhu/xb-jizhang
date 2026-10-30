'use client';

import * as React from 'react';
import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';

export interface UserAuthGuardProps {
  children: React.ReactNode;
}

export function UserAuthGuard({ children }: UserAuthGuardProps): React.JSX.Element {
  return <UserAuthBoundary>{children}</UserAuthBoundary>;
}

