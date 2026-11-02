export type AuthKind = 'user' | 'admin';

export const USER_LOGIN_ROUTE = '/user/login';
export const USER_REGISTER_ROUTE = '/user/register';
export const ADMIN_LOGIN_ROUTE = '/admin/login';

export function isUserRoute(pathname: string): boolean {
  return pathname === '/user' || pathname.startsWith('/user/');
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function getLoginRoute(kind: AuthKind): string {
  return kind === 'admin' ? ADMIN_LOGIN_ROUTE : USER_LOGIN_ROUTE;
}

export function getDefaultRoute(kind: AuthKind): string {
  return kind === 'admin' ? '/admin' : '/user';
}

export function getSafeRedirectTarget(
  target: string | null | undefined,
  kind: AuthKind,
): string {
  const fallback = getDefaultRoute(kind);
  if (
    !target ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.includes('\\') ||
    target.includes('/../')
  ) {
    return fallback;
  }

  if (kind === 'admin') {
    return isAdminRoute(target) && target !== ADMIN_LOGIN_ROUTE ? target : fallback;
  }

  return (
    isUserRoute(target) && target !== USER_LOGIN_ROUTE && target !== USER_REGISTER_ROUTE
      ? target
      : fallback
  );
}

export function getLoginRedirectUrl(kind: AuthKind, pathname: string): string {
  const target = getSafeRedirectTarget(pathname, kind);
  return `${getLoginRoute(kind)}?redirect=${encodeURIComponent(target)}`;
}

export function shouldProtectRoute(pathname: string): boolean {
  if (isUserRoute(pathname)) {
    return pathname !== '/user/login' && pathname !== '/user/register';
  }
  if (isAdminRoute(pathname)) {
    return pathname !== '/admin/login';
  }
  return false;
}

export type UserPrimaryTab = 'home' | 'transactions' | 'profile';

export const USER_PRIMARY_TAB_ROUTES: Record<string, UserPrimaryTab> = {
  '/user': 'home',
  '/user/ledger': 'transactions',
  '/user/profile': 'profile',
};

export function isUserPrimaryTabRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return Object.prototype.hasOwnProperty.call(USER_PRIMARY_TAB_ROUTES, normalized);
}

export function getUserPrimaryTab(pathname: string): UserPrimaryTab | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return USER_PRIMARY_TAB_ROUTES[normalized] ?? null;
}

