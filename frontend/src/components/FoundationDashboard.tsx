'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Cloud, CloudOff, ShieldAlert, Users } from 'lucide-react';
import { getHealth } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { SyncStatusBar } from '@/components/mobile/SyncStatusBar';
import { AmountKeypad } from '@/components/mobile/AmountKeypad';
import { HighRiskActionDialog } from '@/components/admin/HighRiskActionDialog';
import { MaskedField } from '@/components/admin/MaskedField';
import { TableFilterBar } from '@/components/admin/TableFilterBar';

export function FoundationDashboard(): React.JSX.Element {
  const { activeLedger, isOnline, setActiveLedger, setIsOnline } = useAppStore();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'offline'>('checking');

  // 组件预览状态
  const [keypadAmount, setKeypadAmount] = useState('38.50');
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(false);
  const [lastRiskReason, setLastRiskReason] = useState<string | null>(null);

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
      {/* 顶部离线与同步状态胶囊 */}
      <SyncStatusBar
        isOnline={isOnline}
        pendingCount={isOnline ? 0 : 3}
        onRetry={() => alert('触发手动同步离线账单')}
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-emerald-700">共享账本工作区</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">先把账本准备好</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            当前页面用于验证前端、后端、PWA 基础链路及新划分的双端组件库。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {isOnline ? <Cloud size={17} aria-hidden="true" /> : <CloudOff size={17} aria-hidden="true" />}
          {isOnline ? '浏览器在线' : '浏览器离线'}
        </div>
      </div>

      {/* 核心连接状态卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">当前账本</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {activeLedger?.name ?? '还没有选择账本'}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                {activeLedger ? (
                  <>
                    <LedgerBadge type={activeLedger.type} />
                    <LedgerBadge role={activeLedger.role} />
                  </>
                ) : (
                  <span className="text-sm text-slate-600">基础状态已就绪，等待账本模块接入</span>
                )}
              </div>
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
            <span
              className={`size-2.5 rounded-full ${backendStatus === 'ok' ? 'bg-emerald-500' : backendStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-400'}`}
            />
            <span className="text-lg font-semibold text-slate-950">
              {backendStatus === 'ok' ? '已连接' : backendStatus === 'offline' ? '未连接' : '检查中'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            通过 `/api/health` 检查 NestJS 基础服务。
          </p>
        </div>
      </div>

      {/* 组件库实装预览区域 */}
      <div className="mt-10 space-y-6">
        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">双端常用组件工作台预览</h2>
          <p className="text-sm text-slate-500">
            已分层实装通用原子组件、移动端 PWA 手感组件与管理端高风险审计规范组件。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：移动端 PWA 专用组件预览 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">【移动端 PWA】记账数字键盘与金额</span>
              <Badge variant="success">PWA 触控优化</Badge>
            </div>

            <div className="flex items-baseline justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-xs text-slate-500">当前输入金额 (分对应整数)</span>
              <AmountDisplay
                amount={Math.round(parseFloat(keypadAmount || '0') * 100)}
                size="2xl"
                colorSemantic="colored"
                type="EXPENSE"
              />
            </div>

            <AmountKeypad
              value={keypadAmount}
              onChange={setKeypadAmount}
              onSubmit={() => alert(`完成记账：¥${keypadAmount}`)}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-slate-400 self-center">金额展示样例：</span>
              <AmountDisplay amount={12850} colorSemantic="colored" type="INCOME" />
              <AmountDisplay amount={-3500} colorSemantic="colored" type="EXPENSE" />
              <AmountDisplay amount={100000} size="lg" />
            </div>
          </div>

          {/* 右侧：管理端 Admin 专用组件预览 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">【管理端 Admin】数据筛选与审计合规</span>
              <Badge variant="default">平台高风险审计</Badge>
            </div>

            {/* 筛选条 */}
            <TableFilterBar
              keyword={searchKeyword}
              onKeywordChange={setSearchKeyword}
              statusValue={searchStatus}
              onStatusChange={setSearchStatus}
              statusOptions={[
                { label: '正常启用', value: 'ACTIVE' },
                { label: '已被禁用', value: 'DISABLED' },
              ]}
              onSearch={() => alert(`执行查询：关键词="${searchKeyword}", 状态="${searchStatus}"`)}
              onReset={() => {
                setSearchKeyword('');
                setSearchStatus('');
              }}
            />

            {/* 敏感字段脱敏展示 */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
              <p className="font-semibold text-slate-700">敏感数据脱敏查看（记录安全审计）：</p>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">用户手机号：</span>
                <MaskedField
                  maskedValue="138****9988"
                  realValue="13800139988"
                  isRevealed={isPhoneRevealed}
                  onToggleReveal={() => setIsPhoneRevealed(!isPhoneRevealed)}
                />
              </div>
            </div>

            {/* 高风险操作二次确认弹窗触发 */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold">
                <ShieldAlert size={16} />
                高风险操作二次确认（强制填写操作原因）
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                按照《平台管理端需求》，禁用用户、归档账本必须强制填写操作原因并记录到不可篡改审计日志中。
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsRiskDialogOpen(true)}
              >
                触发高风险操作演示
              </Button>
              {lastRiskReason && (
                <p className="text-xs text-emerald-700 font-mono">
                  最近一次操作原因已记入审计：&quot;{lastRiskReason}&quot;
                </p>
              )}
            </div>

            <HighRiskActionDialog
              open={isRiskDialogOpen}
              onOpenChange={setIsRiskDialogOpen}
              title="禁用用户账号"
              description="禁用后该用户的所有当前登录会话将立即撤销，且无法继续在任何账本中记账。"
              targetLabel="张三 (UID: user-sample-001)"
              confirmText="确认禁用账号"
              onConfirm={async (reason) => {
                // 模拟服务端异步操作
                await new Promise((resolve) => setTimeout(resolve, 500));
                setLastRiskReason(reason);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
