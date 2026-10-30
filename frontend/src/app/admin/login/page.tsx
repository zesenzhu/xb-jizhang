'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiRequestError } from '@/lib/api/errors';
import { getCurrentAdmin, loginAdmin } from '@/lib/api/admin-auth-api';
import { getSafeRedirectTarget } from '@/lib/routing/routes';
import { useAdminAuthStore } from '@/store/adminAuthStore';

export default function AdminLoginPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirectTarget(searchParams.get('redirect'), 'admin');
  const status = useAdminAuthStore((state) => state.status);
  const setCurrentAdmin = useAdminAuthStore((state) => state.setCurrentAdmin);
  const setStatus = useAdminAuthStore((state) => state.setStatus);
  const clear = useAdminAuthStore((state) => state.clear);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (status !== 'unknown') return;
    let active = true;
    setStatus('refreshing');
    void getCurrentAdmin()
      .then((admin) => {
        if (active) setCurrentAdmin(admin);
      })
      .catch(() => {
        if (active) clear();
      });

    return () => {
      active = false;
    };
  }, [clear, setCurrentAdmin, setStatus, status]);

  React.useEffect(() => {
    if (status === 'authenticated') router.replace(redirectTarget);
  }, [redirectTarget, router, status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const admin = await loginAdmin({ username: username.trim(), password });
      setCurrentAdmin(admin);
      router.replace(redirectTarget);
    } catch (error: unknown) {
      setErrorMessage(error instanceof ApiRequestError ? error.message : '网络请求异常，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'unknown' || status === 'refreshing' || status === 'authenticated') {
    return <p>正在验证管理员登录状态...</p>;
  }

  return (
    <main>
      <h1>管理员登录</h1>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          管理员账号
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={isLoading}>
          {isLoading ? '正在登录...' : '登录管理端'}
        </button>
      </form>
    </main>
  );
}
