export interface AuthInitializationOptions<T> {
  load: () => Promise<T>;
  isActive: () => boolean;
  onAuthenticated: (value: T) => void;
  onUnauthenticated: () => void;
}

/**
 * 统一收敛会话初始化结果，避免请求结束后遗漏状态变更或写入已卸载的页面。
 */
export async function initializeAuthSession<T>(
  options: AuthInitializationOptions<T>,
): Promise<void> {
  try {
    const value = await options.load();
    if (options.isActive()) options.onAuthenticated(value);
  } catch {
    if (options.isActive()) options.onUnauthenticated();
  }
}
