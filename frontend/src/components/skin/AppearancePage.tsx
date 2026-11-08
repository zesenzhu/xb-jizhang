'use client';

import * as React from 'react';
import { Check, ImagePlus, Palette, RotateCcw, Trash2 } from 'lucide-react';
import { SecondaryLayout } from '@/components/layout/SecondaryLayout';
import { Button } from '@/components/ui/button';
import { useSkinStore } from '@/lib/skin/skin-store';
import {
  SKIN_THEME_OPTIONS,
  SUMMARY_COLOR_PRESETS,
  isHexColor,
  validateSkinImage,
  type SummaryBackground,
} from '@/lib/skin/skin';
import {
  createSkinImageKey,
  deleteSkinImage,
  getSkinImage,
  isLocalImageStorageSupported,
  putSkinImage,
} from '@/lib/skin/local-image';
import { useSummarySurface } from '@/components/skin/use-summary-surface';
import { cn } from '@/lib/utils';

function subscribeNoop(): () => void {
  return () => undefined;
}

const BACKGROUND_OPTIONS: ReadonlyArray<{ id: SummaryBackground['kind']; label: string }> = [
  { id: 'theme', label: '跟随主题' },
  { id: 'color', label: '纯色' },
  { id: 'image', label: '本地图片' },
];

export function AppearancePage(): React.JSX.Element {
  const themeId = useSkinStore((state) => state.themeId);
  const summaryBackground = useSkinStore((state) => state.summaryBackground);
  const setTheme = useSkinStore((state) => state.setTheme);
  const setSummaryBackground = useSkinStore((state) => state.setSummaryBackground);
  const reset = useSkinStore((state) => state.reset);
  const surface = useSummarySurface();

  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [imageBusy, setImageBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // 能力探测是纯读操作，用 useSyncExternalStore 读取，服务端先按「支持」渲染。
  const storageSupported = React.useSyncExternalStore(
    subscribeNoop,
    () => isLocalImageStorageSupported(),
    () => true,
  );

  const switchBackground = (kind: SummaryBackground['kind']): void => {
    setError(null);
    if (kind === 'theme') {
      setSummaryBackground({ kind: 'theme' });
      return;
    }
    if (kind === 'color') {
      const current = summaryBackground.kind === 'color' ? summaryBackground.color : SUMMARY_COLOR_PRESETS[0];
      setSummaryBackground({ kind: 'color', color: current });
      return;
    }
    // 选图：保留当前图片键，没有则等待用户选文件。
    if (summaryBackground.kind === 'image') return;
    setSummaryBackground({ kind: 'image', imageKey: '' });
  };

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validation = validateSkinImage(file);
    if (!validation.ok) {
      setError(
        validation.reason === 'type'
          ? '只支持 JPG、PNG、WebP'
          : validation.reason === 'size'
            ? '图片不能超过 6MB'
            : '图片为空，请重新选择',
      );
      return;
    }

    setError(null);
    setImageBusy(true);
    try {
      const key = createSkinImageKey();
      await putSkinImage(key, file);
      // 换图时清掉旧键，避免本地残留。
      if (summaryBackground.kind === 'image' && summaryBackground.imageKey) {
        const previousKey = summaryBackground.imageKey;
        if (previousKey !== key) await deleteSkinImage(previousKey);
      }
      setSummaryBackground({ kind: 'image', imageKey: key });
    } catch {
      setError('本地图片保存失败，可能是浏览器存储空间不足');
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveImage = async (): Promise<void> => {
    if (summaryBackground.kind === 'image' && summaryBackground.imageKey) {
      await deleteSkinImage(summaryBackground.imageKey).catch(() => undefined);
    }
    setSummaryBackground({ kind: 'theme' });
  };

  const hasImage = summaryBackground.kind === 'image' && Boolean(summaryBackground.imageKey);

  return (
    <SecondaryLayout title="外观与皮肤" subtitle="个人设置" fallbackBackUrl="/user/profile">
      <div className="mx-auto max-w-md space-y-5 px-4 py-4">
        {/* 预览：与账本页共用同一套背景解析逻辑 */}
        <section
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-cover bg-center p-5 text-white shadow-xl"
          style={surface}
        >
          <p className="text-xs font-medium text-white/60">总支出</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-tight">¥1,280.00</p>
          <p className="mt-3 text-xs text-white/70">预览效果，实际以账本页为准</p>
        </section>

        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-text-muted">主题色</p>
          <div className="grid grid-cols-4 gap-2">
            {SKIN_THEME_OPTIONS.map((option) => {
              const active = option.id === themeId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-colors active:scale-95',
                    active ? 'border-primary bg-primary/10' : 'border-app-border bg-app-card',
                  )}
                >
                  <span
                    className="flex size-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: option.swatch }}
                  >
                    {active && <Check size={14} className="text-white" />}
                  </span>
                  <span className="text-[11px] text-text-muted">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-text-muted">总支出卡片背景</p>
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUND_OPTIONS.map((option) => {
              const active = summaryBackground.kind === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => switchBackground(option.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl border px-2 py-2.5 text-xs transition-colors active:scale-95',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-app-border bg-app-card text-text-muted',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {summaryBackground.kind === 'color' && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-app-border bg-app-card p-3">
              {SUMMARY_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`使用底色 ${color}`}
                  onClick={() => setSummaryBackground({ kind: 'color', color })}
                  className={cn(
                    'size-8 rounded-full border-2',
                    summaryBackground.kind === 'color' && summaryBackground.color === color
                      ? 'border-primary'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-[11px] text-text-muted">
                自定义
                <input
                  type="color"
                  value={summaryBackground.color}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isHexColor(value)) setSummaryBackground({ kind: 'color', color: value });
                  }}
                  className="size-7 cursor-pointer rounded border border-app-border bg-transparent"
                />
              </label>
            </div>
          )}

          {summaryBackground.kind === 'image' && (
            <div className="space-y-2 rounded-2xl border border-app-border bg-app-card p-3">
              <p className="text-[11px] leading-relaxed text-text-muted">
                图片只保存在本机浏览器，不会上传服务器；换设备或清理浏览器数据后需要重新选择。
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={imageBusy || !storageSupported}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={14} className="mr-1" />
                  {hasImage ? '更换图片' : '选择图片'}
                </Button>
                {hasImage && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleRemoveImage()}>
                    <Trash2 size={14} className="mr-1" />
                    移除
                  </Button>
                )}
              </div>
              {!storageSupported && (
                <p className="text-[11px] text-rose-600">当前浏览器不支持本地图片存储</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handlePickImage(event)}
              />
            </div>
          )}

          {error && <p className="px-1 text-[11px] text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-app-border bg-app-card px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <Palette size={14} />
            恢复默认外观
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void handleRemoveImage();
              reset();
            }}
          >
            <RotateCcw size={14} className="mr-1" />
            恢复
          </Button>
        </div>
      </div>
    </SecondaryLayout>
  );
}
