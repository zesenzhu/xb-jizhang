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

/** 键盘开合判定阈值：过滤地址栏收起等小幅变化，避免编辑条来回跳。 */
export const KEYBOARD_OPEN_THRESHOLD = 120;

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
 * 移动端系统键盘不会改变 `100dvh`，只会改变 visualViewport。
 * 统一在这里读取高度和键盘占位，避免各组件自行监听导致抖动或重复计算。
 */
export function useVisualViewport(): VisualViewportMetrics {
  const [metrics, setMetrics] = React.useState<VisualViewportMetrics>(FALLBACK_VIEWPORT_METRICS);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    const read = (): void => {
      setMetrics(
        computeViewportMetrics({
          viewportHeight: viewport?.height ?? window.innerHeight,
          viewportOffsetTop: viewport?.offsetTop ?? 0,
          layoutHeight: window.innerHeight,
        }),
      );
    };

    read();
    viewport?.addEventListener('resize', read);
    viewport?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      viewport?.removeEventListener('resize', read);
      viewport?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return metrics;
}
