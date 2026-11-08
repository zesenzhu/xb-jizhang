'use client';

import * as React from 'react';
import { useSkinStore } from '@/lib/skin/skin-store';
import { getSkinImage } from '@/lib/skin/local-image';
import { resolveSummarySurface, type SummarySurface } from '@/lib/skin/skin';

function subscribeNoop(): () => void {
  return () => undefined;
}

/**
 * 把本地图片键解析成可用的对象地址，并在切换/卸载时回收。
 *
 * 不用 effect 里同步 setState：
 * - 没有图片时什么也不写，「无图」直接由 wantedKey 是否为 null 派生；
 * - 读到图后写入 `{key, url}`，只有 key 与当前设置一致才采用，避免旧图串到新设置上。
 */
export function useSummarySurface(): SummarySurface {
  const summaryBackground = useSkinStore((state) => state.summaryBackground);
  const [loaded, setLoaded] = React.useState<{ key: string; url: string } | null>(null);

  const wantedKey = summaryBackground.kind === 'image' ? summaryBackground.imageKey : null;

  React.useEffect(() => {
    if (!wantedKey) return;

    let revoked = false;
    let objectUrl: string | null = null;

    void getSkinImage(wantedKey)
      .then((blob) => {
        if (!blob || revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key: wantedKey, url: objectUrl });
      })
      .catch(() => {
        // 读图失败就用主题背景，不阻断渲染，也不再写状态。
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [wantedKey]);

  // 挂载判定沿用项目里已有的 useSyncExternalStore 写法，避免水合期间读 IndexedDB。
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const imageUrl = mounted && wantedKey && loaded?.key === wantedKey ? loaded.url : null;

  return React.useMemo(
    () => resolveSummarySurface({ background: summaryBackground, imageUrl }),
    [summaryBackground, imageUrl],
  );
}
