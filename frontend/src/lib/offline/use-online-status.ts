'use client';

import * as React from 'react';
import { useOfflineStore } from '@/store/offlineStore';

/**
 * 同步 `navigator.onLine` 到 `useOfflineStore`。
 *
 * 浏览器只在网络状态真的变化时派发 `online` / `offline`，所以初始化时读一次，
 * 之后靠事件维持；不做轮询，也不用定时器猜。
 */
export function useOnlineStatusSync(): void {
  const setOnline = useOfflineStore((store) => store.setOnline);

  React.useEffect(() => {
    const update = (): void => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [setOnline]);
}
