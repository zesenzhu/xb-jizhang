'use client';

export default function UserError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>): React.JSX.Element {
  return (
    <main>
      <h1>用户端加载失败</h1>
      <p>页面暂时无法加载，请稍后重试。</p>
      <button type="button" onClick={reset}>
        重试
      </button>
    </main>
  );
}
