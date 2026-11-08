'use client';

import * as React from 'react';

export interface VisualViewportMetrics {
  /** 可视视口高度（px）；不支持 visualViewport 时回退 innerHeight */
  height: number;
  /** 可视视口相对布局视口的偏移 */
  offsetTop: number;
  /** 系统键盘占位高度估算 */
  keyboardInset: number;
  isKeyboardOpen: boolean;
}

/** 键盘开合判定阈值：过滤地址栏收起等小幅变化。 */
export const KEYBOARD_OPEN_THRESHOLD = 120;

/**
 * 高度变化的最小采纳步长。
 *
 * iOS 键盘弹出过程中 visualViewport 会连续上报十几个中间值，逐帧 setState 会让
 * 依赖它的布局（底部区抬升）反复重排，实测表现为键盘「弹上弹下」。
 * 只有变化超过该步长、或开合状态翻转时才采纳新值。
 */
export const VIEWPORT_STABLE_DELTA = 24;

export const FALLBACK_VIEWPORT_METRICS: VisualViewportMetrics = {
  height: 0,
  offsetTop: 0,
  keyboardInset: 0,
  isKeyboardOpen: false,
};

export interface ViewportSnapshot {
  /** 可视视口高度；无 visualViewport 时传 innerHeight */
  viewportHeight: number;
  /** 可视视口偏移；无 visualViewport 时传 0 */
  viewportOffsetTop: number;
  /** 布局视口高度，用于反推键盘占位 */
  layoutHeight: number;
}

/**
 * 由视口快照推导键盘占位。
 *
 * iOS 键盘不改变布局视口，只压缩 visualViewport 并可能让页面被系统滚动；
 * 因此键盘高度 = 布局视口高度 - 可视视口高度 - 可视视口偏移，且不得为负。
 */
export function computeViewportMetrics(snapshot: ViewportSnapshot): VisualViewportMetrics {
  const height = Math.max(0, snapshot.viewportHeight);
  const offsetTop = Math.max(0, snapshot.viewportOffsetTop);
  const layoutHeight = Math.max(0, snapshot.layoutHeight);
  const keyboardInset = Math.max(0, layoutHeight - height - offsetTop);
  return {
    height,
    offsetTop,
    keyboardInset,
    isKeyboardOpen: keyboardInset > KEYBOARD_OPEN_THRESHOLD,
  };
}

/**
 * 判断新采样是否值得写入状态：开合翻转必采纳，其余按步长量化，避免中间帧抖动。
 */
export function shouldApplyViewportUpdate(
  previous: VisualViewportMetrics,
  next: VisualViewportMetrics,
): boolean {
  if (previous.isKeyboardOpen !== next.isKeyboardOpen) return true;
  if (previous.height === 0) return true;
  return Math.abs(previous.keyboardInset - next.keyboardInset) >= VIEWPORT_STABLE_DELTA;
}

/**
 * 移动端系统键盘不会改变 `100dvh`，只会改变 visualViewport。
 * 统一在这里读取高度和键盘占位，避免各组件自行监听导致抖动或重复计算。
 */
export function useVisualViewport(): VisualViewportMetrics {
  const [metrics, setMetrics] = React.useState<VisualViewportMetrics>(FALLBACK_VIEWPORT_METRICS);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;

    const measure = (): void => {
      const next = computeViewportMetrics({
        viewportHeight: viewport?.height ?? window.innerHeight,
        viewportOffsetTop: viewport?.offsetTop ?? 0,
        layoutHeight: window.innerHeight,
      });
      setMetrics((previous) =>
        shouldApplyViewportUpdate(previous, next) ? next : previous,
      );
    };

    // 同一帧内的多次 resize/scroll 只算一次，避免键盘动画期间连续重排。
    const schedule = (): void => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return metrics;
}
