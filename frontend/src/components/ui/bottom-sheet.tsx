'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** nested 用于二级浮层（分类选择），层级高于基础抽屉 */
  layer?: 'base' | 'nested';
  /**
   * sheet：底部面板，最高 88vh，圆角顶。
   * full：全屏，键盘固定在底部时用这个，中间内容才有足够高度滚动。
   */
  variant?: 'sheet' | 'full';
  /** 返回 false 阻止关闭，用于未保存内容确认 */
  onBeforeClose?: () => boolean;
  children: React.ReactNode;
  className?: string;
}

/** 退场动画时长；与 globals.css 的 sheet-fall / overlay-fade-out 保持一致。 */
const SHEET_EXIT_MS = 220;

/**
 * 抽屉正文的必备结构。
 *
 * 面板本身是 `overflow-hidden` + `max-h-[88vh]`：正文若不让出滚动权，
 * 内容一旦超过 88vh 就会被直接裁切，底部按钮永远不可见，且横向内边距与
 * Home Indicator 留白都会丢失。所有抽屉都必须按有无固定页脚二选一：
 *
 * - 正文 + 固定页脚：正文 `SHEET_BODY_SCROLL`，页脚 `SHEET_FOOTER`
 * - 只有正文（按钮在正文内）：`SHEET_BODY_SCROLL_ALONE`，由正文自带安全区
 *
 * 全站不再各写一份，避免再次漏掉 `min-h-0`、`overflow-y-auto` 或安全区。
 */
export const SHEET_BODY_SCROLL =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-3';

/** 无固定页脚时使用：正文自己承担底部安全区，否则按钮会贴住 Home Indicator。 */
export const SHEET_BODY_SCROLL_ALONE =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]';

export const SHEET_FOOTER =
  'shrink-0 border-t border-app-divider px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3';

const LAYER_CLASS = {
  base: 'z-50',
  nested: 'z-[60]',
} as const;

/**
 * 底部面板原语。
 *
 * 与 `ui/dialog.tsx` 的差异：挂载到 body（避免父级 overflow 裁剪）、
 * 保存并恢复 `body.overflow` 原值（嵌套面板不会互相清空滚动锁）、
 * 焦点在打开时进入面板、关闭后归还触发元素。
 */
function subscribeNoop(): () => void {
  return () => undefined;
}

/**
 * body 滚动锁的引用计数。
 *
 * 面板可以嵌套（记账面板里再开分类面板），各自保存/恢复 overflow 会互相覆盖：
 * 内层关闭时把外层需要的 hidden 恢复成 ''，或外层关闭后又把内层留在 hidden，
 * 结果就是「面板关了，账单页却滚不动」。
 */
let bodyScrollLocks = 0;
let bodyOverflowBeforeLock = '';

function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (bodyScrollLocks === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLocks += 1;
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  bodyScrollLocks = Math.max(0, bodyScrollLocks - 1);
  if (bodyScrollLocks === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock;
    bodyOverflowBeforeLock = '';
  }
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  layer = 'base',
  variant = 'sheet',
  onBeforeClose,
  children,
  className,
}: BottomSheetProps): React.JSX.Element | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  /**
   * `open` 变 false 后不能立刻卸载，否则收起动画来不及播放、面板直接消失。
   * presence 负责「多留一帧」：先切到 exiting（播退场），动画结束再真正移除。
   */
  const [presence, setPresence] = React.useState<'closed' | 'entering' | 'exiting'>(
    open ? 'entering' : 'closed',
  );
  const [wasOpen, setWasOpen] = React.useState(open);

  // 用渲染期比较代替 effect：打开时当帧就要进入 entering，避免闪一帧空白。
  if (wasOpen !== open) {
    setWasOpen(open);
    setPresence(open ? 'entering' : 'exiting');
  }

  // 退场动画结束后卸载。entering 直接落回 entering（保持挂载），不改状态。
  React.useEffect(() => {
    if (presence !== 'exiting') return;
    const timer = window.setTimeout(() => setPresence('closed'), SHEET_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [presence]);
  // SSR 阶段没有 document，用 useSyncExternalStore 做水合判定，避免在 effect 里 setState。
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const requestClose = React.useCallback((): void => {
    if (onBeforeClose && !onBeforeClose()) return;
    onOpenChange(false);
  }, [onBeforeClose, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }, 60);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
      unlockBodyScroll();
      restoreFocusRef.current?.focus?.();
    };
  }, [open, requestClose]);

  if (!mounted || presence === 'closed') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-end justify-center',
        LAYER_CLASS[layer],
        // 退场期间面板已不可交互，避免动画中被点到。
        presence === 'exiting' && 'pointer-events-none',
      )}
      aria-hidden={presence === 'exiting' || undefined}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/40',
          presence === 'exiting'
            ? 'motion-safe:animate-[overlay-fade-out_180ms_ease-out_forwards]'
            : 'motion-safe:animate-[overlay-fade_180ms_ease-out]',
        )}
        onClick={requestClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex w-full flex-col overflow-hidden bg-app-card shadow-2xl',
          // 两种形态都是「从底部升起」的面板：顶部两角半圆，向下不留圆角。
          variant === 'full'
            ? 'h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-w-md rounded-t-[1.75rem] pt-[env(safe-area-inset-top)]'
            : 'max-h-[88vh] max-w-md rounded-t-[1.75rem]',
          presence === 'exiting'
            ? 'motion-safe:animate-[sheet-fall_220ms_cubic-bezier(0.4,0,0.6,1)_forwards]'
            : 'motion-safe:animate-[sheet-rise_240ms_cubic-bezier(0.32,0.72,0,1)]',
          className,
        )}
      >
        {title !== undefined && (
          <header className="flex shrink-0 items-center justify-between border-b border-app-divider px-4 py-3">
            <span className="text-sm font-semibold text-text-main">{title}</span>
            <button
              type="button"
              onClick={requestClose}
              aria-label="关闭"
              className="flex size-8 items-center justify-center rounded-full bg-app-card-subtle text-text-muted transition-colors active:scale-95 hover:text-text-main"
            >
              <X size={16} />
            </button>
          </header>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
}
