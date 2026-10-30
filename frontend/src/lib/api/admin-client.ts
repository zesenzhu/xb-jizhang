import { createApiClient } from './client';
import { getLoginRedirectUrl } from '@/lib/routing/routes';
import { useAdminAuthStore } from '@/store/adminAuthStore';

export const ADMIN_REFRESH_PATH = '/admin/auth/refresh';

function handleAdminRefreshFailure(): void {
  useAdminAuthStore.getState().clear();
  if (typeof window !== 'undefined' && window.location.pathname !== '/admin/login') {
    window.location.replace(getLoginRedirectUrl('admin', window.location.pathname));
  }
}

export const adminClient = createApiClient({
  refreshPath: ADMIN_REFRESH_PATH,
  skipRefreshPaths: ['/admin/auth/login'],
  onRefreshFailure: handleAdminRefreshFailure,
});
