import { createApiClient } from './client';
import { getLoginRedirectUrl } from '@/lib/routing/routes';
import { useUserAuthStore } from '@/store/userAuthStore';

export const USER_REFRESH_PATH = '/auth/refresh';

function handleUserRefreshFailure(): void {
  useUserAuthStore.getState().clear();
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/user/login' &&
    window.location.pathname !== '/user/register'
  ) {
    window.location.replace(getLoginRedirectUrl('user', window.location.pathname));
  }
}

export const userClient = createApiClient({
  refreshPath: USER_REFRESH_PATH,
  skipRefreshPaths: ['/auth/login', '/auth/register'],
  onRefreshFailure: handleUserRefreshFailure,
});
