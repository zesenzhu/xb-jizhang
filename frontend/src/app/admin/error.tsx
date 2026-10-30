'use client';

export default function AdminError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>): React.JSX.Element {
  return (
    <main>
      <h1>管理端加载失败</h1>
      <p>{error.message}</p>
      <button type="button" onClick={reset}>
        重试
      </button>
    </main>
  );
}
