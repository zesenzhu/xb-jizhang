'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/lib/api/errors';

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isUnauthorizedError(error)) return false;
  return failureCount < 1;
}

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
