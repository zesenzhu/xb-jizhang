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

const FALLBACK: VisualViewportMetrics = {
  height: 0,
  offsetTop: 0,
  keyboardInset: 0,
  isKeyboardOpen: false,
};

/**
 * 移动端系统键盘不会改变 `100dvh`，只会改变 visualViewport。
 * 统一在这里读取高度和键盘占位，避免各组件自行监听导致抖动或重复计算。
 */
export function useVisualViewport(): VisualViewportMetrics {
  const [metrics, setMetrics] = React.useState<VisualViewportMetrics>(FALLBACK);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    const read = (): void => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop);
      setMetrics({
        height,
        offsetTop,
        keyboardInset,
        // 120px 阈值过滤地址栏收起等小幅变化，避免编辑条来回跳。
        isKeyboardOpen: keyboardInset > 120,
      });
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
