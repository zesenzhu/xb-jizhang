'use client';

import * as React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface HighRiskActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 高风险操作标题，如“禁用用户账号”或“归档当前账本” */
  title: string;
  /** 影响与警告描述，如“禁用后该用户将立即断开所有登录会话，且无法执行记账写操作” */
  description: string;
  /** 目标对象识别，如“目标用户：张三 (UID: user-102)” */
  targetLabel: string;
  /** 点击确认执行回调，回传已填写的操作原因 */
  onConfirm: (reason: string) => Promise<void> | void;
  /** 确认按钮文案，默认为“确认执行操作” */
  confirmText?: string;
  /** 操作原因最少字数限制，默认 5 个字符 */
  minReasonLength?: number;
}

export function HighRiskActionDialog({
  open,
  onOpenChange,
  title,
  description,
  targetLabel,
  onConfirm,
  confirmText = '确认执行操作',
  minReasonLength = 5,
}: HighRiskActionDialogProps): React.JSX.Element {
  const [reason, setReason] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // 弹窗关闭时重置状态
  React.useEffect(() => {
    if (!open) {
      setReason('');
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [open]);

  const isReasonValid = reason.trim().length >= minReasonLength;

  const handleConfirm = async (): Promise<void> => {
    if (!isReasonValid) {
      setErrorMessage(`请至少填写 ${minReasonLength} 个字符的操作原因`);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '操作执行失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCloseButton onClose={() => onOpenChange(false)} />

      <DialogHeader>
        <div className="flex items-center gap-2 text-rose-600">
          <ShieldAlert size={22} aria-hidden="true" />
          <DialogTitle>{title}</DialogTitle>
        </div>
        <DialogDescription className="mt-2 text-slate-600">{description}</DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {/* 目标对象卡片 */}
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200/80">
          <span className="font-semibold text-slate-900">操作对象：</span>
          <span className="font-mono">{targetLabel}</span>
        </div>

        {/* 审计警告卡片 */}
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200/60">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">合规审计提醒</p>
            <p className="mt-0.5 text-amber-700 leading-relaxed">
              此操作属于平台高风险权限，操作人、时间、IP 及填写的操作原因将被系统永久写入不可篡改的审计日志。
            </p>
          </div>
        </div>

        {/* 操作原因输入框（强制非空校验） */}
        <div>
          <label htmlFor="risk-action-reason" className="block text-xs font-semibold text-slate-800">
            操作原因 <span className="text-rose-500">*（必填）</span>
          </label>
          <textarea
            id="risk-action-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="请详细说明执行此操作的业务原因或工单编号（至少 5 字）..."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{errorMessage ? <span className="text-rose-600">{errorMessage}</span> : '平台审计凭证'}</span>
            <span className={cn(reason.trim().length >= minReasonLength ? 'text-emerald-600 font-medium' : 'text-slate-400')}>
              {reason.trim().length} / {minReasonLength} 字
            </span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
        >
          取消
        </Button>
        <Button
          variant="destructive"
          onClick={() => void handleConfirm()}
          disabled={!isReasonValid || isLoading}
          isLoading={isLoading}
          loadingText="正在执行..."
        >
          {confirmText}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

