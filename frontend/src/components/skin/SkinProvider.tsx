'use client';

import * as React from 'react';
import { useSkinStore } from '@/lib/skin/skin-store';

/**
 * 把皮肤主题写进 `<html data-theme>`。
 *
 * 主题色本身仍由 globals.css 的变量控制，这里只切属性，
 * 避免在 JS 里维护一套颜色常量与 CSS 漂移。
 */
export function SkinProvider(): null {
  const themeId = useSkinStore((state) => state.themeId);

  React.useEffect(() => {
    const root = document.documentElement;
    if (themeId === 'default') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeId);
  }, [themeId]);

  return null;
}
