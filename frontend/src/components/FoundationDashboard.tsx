'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Cloud, CloudOff, Users } from 'lucide-react';
import { getHealth } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';

export function FoundationDashboard(): React.JSX.Element {
  const { activeLedger, isOnline, setActiveLedger, setIsOnline } = useAppStore();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'offline'>('checking');

  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    void getHealth()
      .then(() => setBackendStatus('ok'))
      .catch(() => setBackendStatus('offline'));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-emerald-700">共享账本工作区</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">先把账本准备好</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            当前页面用于验证前端、后端和 PWA 基础链路。账本、成员和记账功能将在基础框架稳定后接入。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {isOnline ? <Cloud size={17} aria-hidden="true" /> : <CloudOff size={17} aria-hidden="true" />}
          {isOnline ? '浏览器在线' : '浏览器离线'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">当前账本</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {activeLedger?.name ?? '还没有选择账本'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {activeLedger ? `${activeLedger.type === 'SHARED' ? '共享账本' : '个人账本'} · ${activeLedger.role}` : '基础状态已就绪，等待账本模块接入'}
              </p>
            </div>
            <Users className="text-emerald-600" size={22} aria-hidden="true" />
          </div>
          {!activeLedger && (
            <button
              type="button"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              onClick={() =>
                setActiveLedger({
                  id: 'local-foundation-ledger',
                  name: '我的个人账本',
                  type: 'PERSONAL',
                  role: 'OWNER',
                })
              }
            >
              设置本地账本状态
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">后端连接</p>
          <div className="mt-4 flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${backendStatus === 'ok' ? 'bg-emerald-500' : backendStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-400'}`} />
            <span className="text-lg font-semibold text-slate-950">
              {backendStatus === 'ok' ? '已连接' : backendStatus === 'offline' ? '未连接' : '检查中'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            通过 `/api/health` 检查 NestJS 基础服务。
          </p>
        </div>
      </div>
    </section>
  );
}
