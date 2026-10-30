import { createApiClient } from './client';
import { useAdminAuthStore } from '@/store/adminAuthStore';

export const ADMIN_REFRESH_PATH = '/admin/auth/refresh';

function handleAdminRefreshFailure(): void {
  useAdminAuthStore.getState().clear();
  if (typeof window !== 'undefined' && window.location.pathname !== '/admin/login') {
    window.location.replace('/admin/login');
  }
}

export const adminClient = createApiClient({
  refreshPath: ADMIN_REFRESH_PATH,
  onRefreshFailure: handleAdminRefreshFailure,
});
