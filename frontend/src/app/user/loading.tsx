import * as React from 'react';

/**
 * 客户端路由过渡 Loading 占位
 * 采用轻量非侵入式微进度指示，避免全屏遮罩（如 min-h-[70vh]）强行清空页面视口引发的剧烈跳闪
 */
export default function UserLoading(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="w-full flex justify-center py-6 select-none opacity-80"
    >
      <div className="h-1 w-20 rounded-full bg-primary/20 overflow-hidden relative">
        <div className="absolute inset-0 bg-primary/70 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
