export type AuthKind = 'user' | 'admin';

export function isUserRoute(pathname: string): boolean {
  return pathname === '/user' || pathname.startsWith('/user/');
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function getLoginRoute(kind: AuthKind): string {
  return kind === 'admin' ? '/admin/login' : '/user/login';
}

export function getDefaultRoute(kind: AuthKind): string {
  return kind === 'admin' ? '/admin' : '/user';
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
