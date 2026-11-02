'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SecondaryLayoutProps {
  /** 二级页面标题，如“我的账本”、“新建账本” */
  title: string;
  /** 返回按钮文案，默认为“返回” */
  backText?: string;
  /** 兜底返回路径，当浏览器没有上一页历史时回退到此路径，默认为 /user */
  fallbackBackUrl?: string;
  /** 自定义返回动作 */
  onBack?: () => void;
  /** 右侧扩展操作区（如“+ 新建”、“保存”等） */
  rightAction?: React.ReactNode;
  /** 可选顶部小副标，如“用户工作区” */
  subtitle?: string;
  /** 页面主体内容 */
  children: React.ReactNode;
  className?: string;
}

/**
 * 移动端二级页面统一容器布局组件
 * - 规范：隐藏底部 TabBar，顶部吸顶统一返回栏与标题，自动适配安全区
 */
export function SecondaryLayout({
  title,
  backText = '返回',
  fallbackBackUrl = '/user',
  onBack,
  rightAction,
  subtitle,
  children,
  className,
}: SecondaryLayoutProps): React.JSX.Element {
  const router = useRouter();

  const handleBack = (): void => {
    if (onBack) {
      onBack();
      return;
    }
    // 如果存在历史记录则返回上一页，否则跳往兜底路径
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackBackUrl);
    }
  };

  return (
    <div className={cn('min-h-screen bg-app-bg text-text-main pb-safe select-none', className)}>
      {/* 顶部二级吸顶导航栏 */}
      <header className="sticky top-0 z-30 border-b border-app-border/40 bg-app-bg/90 backdrop-blur-md pt-safe">
        <div className="max-w-md mx-auto flex h-12 items-center justify-between px-3">
          {/* 左侧返回按钮 */}
          <div className="flex-1 flex justify-start">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-0.5 rounded-xl px-2 py-1.5 text-sm font-medium text-primary active:opacity-60 transition"
              aria-label={backText}
            >
              <ChevronLeft size={20} strokeWidth={2.4} />
              <span>{backText}</span>
            </button>
          </div>

          {/* 中间标题 */}
          <div className="flex flex-col items-center justify-center text-center">
            {subtitle && (
              <span className="text-[10px] font-medium text-text-muted leading-tight">
                {subtitle}
              </span>
            )}
            <h1 className="text-base font-semibold text-text-main truncate max-w-[200px]">
              {title}
            </h1>
          </div>

          {/* 右侧扩展操作区 */}
          <div className="flex-1 flex justify-end">
            {rightAction ? (
              <div className="flex items-center">{rightAction}</div>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </div>
      </header>

      {/* 二级页面主体内容（拥有全屏空间，无底部 TabBar 遮挡） */}
      <main className="max-w-md mx-auto px-4 py-4">{children}</main>
    </div>
  );
}

/**
 * 独立的吸顶二级导航头组件（若页面已有外部外壳时可单独使用）
 */
export function SecondaryHeader({
  title,
  backText = '返回',
  fallbackBackUrl = '/user',
  onBack,
  rightAction,
  subtitle,
  className,
}: Omit<SecondaryLayoutProps, 'children'>): React.JSX.Element {
  const router = useRouter();

  const handleBack = (): void => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackBackUrl);
    }
  };

  return (
    <header className={cn('sticky top-0 z-30 border-b border-app-border/40 bg-app-bg/90 backdrop-blur-md pt-safe', className)}>
      <div className="max-w-md mx-auto flex h-12 items-center justify-between px-3">
        <div className="flex-1 flex justify-start">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-0.5 rounded-xl px-2 py-1.5 text-sm font-medium text-primary active:opacity-60 transition"
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
            <span>{backText}</span>
          </button>
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          {subtitle && (
            <span className="text-[10px] font-medium text-text-muted leading-tight">
              {subtitle}
            </span>
          )}
          <h1 className="text-base font-semibold text-text-main truncate max-w-[200px]">
            {title}
          </h1>
        </div>

        <div className="flex-1 flex justify-end">
          {rightAction ? rightAction : <div className="w-9" />}
        </div>
      </div>
    </header>
  );
}

