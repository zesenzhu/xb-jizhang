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

/**
 * 只允许邀请页把 token/action 带过登录流程。
 * 其他页面即使手工构造 redirect，也会被丢弃查询串，避免开放重定向或参数注入。
 */
const REDIRECT_QUERY_ALLOWLIST: Record<string, readonly string[]> = {
  '/user/invitations': ['token', 'action'],
};

function safePathname(pathname: string, kind: AuthKind): string | null {
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.includes('\\') ||
    pathname.includes('/../')
  ) {
    return null;
  }
  if (kind === 'admin') {
    return isAdminRoute(pathname) && pathname !== ADMIN_LOGIN_ROUTE ? pathname : null;
  }
  return isUserRoute(pathname) && pathname !== USER_LOGIN_ROUTE && pathname !== USER_REGISTER_ROUTE
    ? pathname
    : null;
}

export function getSafeRedirectTarget(
  target: string | null | undefined,
  kind: AuthKind,
): string {
  const fallback = getDefaultRoute(kind);
  if (!target) return fallback;
  // 先拒绝路径穿越和反斜杠，再交给 URL 解析；否则 /user/../admin 会被规范化成 /admin。
  if (target.includes('/../') || target.includes('\\')) return fallback;

  // 用固定 base 解析，拒绝绝对 URL 和协议相对地址。
  let parsed: URL;
  try {
    parsed = new URL(target, 'https://jizhang.invalid');
  } catch {
    return fallback;
  }
  if (parsed.origin !== 'https://jizhang.invalid') return fallback;

  const pathname = parsed.pathname;
  const validatedPath = safePathname(pathname, kind);
  if (!validatedPath) return fallback;

  const allowedKeys = REDIRECT_QUERY_ALLOWLIST[validatedPath] ?? [];
  const kept = new URLSearchParams();
  for (const key of allowedKeys) {
    const value = parsed.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  return kept.size > 0 ? `${validatedPath}?${kept.toString()}` : validatedPath;
}

export function getLoginRedirectUrl(
  kind: AuthKind,
  pathname: string,
  search?: string,
): string {
  const target = getSafeRedirectTarget(`${pathname}${search ?? ''}`, kind);
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

/**
 * 二期底部主导航固定为三项：账本、统计、我的（二期需求 5.1）。
 *
 * 变化点：
 * - 移除独立「明细」入口，账本页即明细
 * - 移除底栏中央「记账」入口，记账只保留账本页 FAB
 * - 移除「资产」入口，二期没有资产功能
 */
export type UserPrimaryTab = 'ledger' | 'statistics' | 'profile';

export const USER_PRIMARY_TAB_ROUTES: Record<string, UserPrimaryTab> = {
  '/user': 'ledger',
  '/user/statistics': 'statistics',
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

