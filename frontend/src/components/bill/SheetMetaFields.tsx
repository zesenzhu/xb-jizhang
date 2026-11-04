'use client';

import * as React from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SheetMetaFieldsProps {
  /** datetime-local 控件的值，格式 `YYYY-MM-DDTHH:mm` */
  occurredAtInput: string;
  /** 压缩显示的时间，如 `19:02` */
  occurredAtLabel: string;
  title: string;
  note: string;
  noteMaxLength: number;
  onOccurredAtChange: (value: string) => void;
  onTitleChange: (title: string) => void;
  onNoteChange: (note: string) => void;
  timeError: string | null;
}

/**
 * 金额卡内的第二行：时间 + 商家/备注 + 展开。
 *
 * 时间只显示 `HH:mm`（日期由记账当月决定，跨天需要改日期时才展开完整选择器），
 * 点时间胶囊弹出原生 datetime-local，不再单独占一整行。
 */
export function SheetMetaFields({
  occurredAtInput,
  occurredAtLabel,
  title,
  note,
  noteMaxLength,
  onOccurredAtChange,
  onTitleChange,
  onNoteChange,
  timeError,
}: SheetMetaFieldsProps): React.JSX.Element {
  const [noteExpanded, setNoteExpanded] = React.useState(false);
  const timeInputRef = React.useRef<HTMLInputElement | null>(null);

  /**
   * 时间胶囊是唯一可见的时间入口。原生 datetime-local 常驻但视觉隐藏：
   * `showPicker` 必须在用户手势的同一任务里调用，等挂载后再调会失效；
   * 不支持的浏览器（旧 Safari）退化为聚焦，同样会拉起系统选择器。
   */
  const openDatePicker = (): void => {
    const input = timeInputRef.current;
    if (!input) return;
    input.focus();
    input.showPicker?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openDatePicker}
          aria-label={`发生时间 ${occurredAtLabel}，点击修改`}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] tabular-nums transition-colors active:scale-95',
            timeError
              ? 'border-rose-300 bg-rose-50 text-rose-600'
              : 'border-app-border bg-app-card-subtle text-text-muted',
          )}
        >
          <Clock size={12} />
          {occurredAtLabel}
          {timeError && <span className="text-[10px]">{timeError}</span>}
        </button>

        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="商家 / 对象"
          maxLength={200}
          aria-label="商家或对象"
          className="min-w-0 flex-1 bg-transparent text-xs text-text-main placeholder:text-text-tertiary focus:outline-none"
        />

        <button
          type="button"
          onClick={() => setNoteExpanded((value) => !value)}
          aria-label={noteExpanded ? '收起备注' : '展开备注'}
          aria-expanded={noteExpanded}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-tertiary active:scale-95"
        >
          <ChevronDown size={15} className={cn('transition-transform', noteExpanded && 'rotate-180')} />
        </button>
      </div>

      {/* 备注：单行 ⇄ 多行，始终只有一个可编辑控件。 */}
      {noteExpanded ? (
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="点击填写备注"
          maxLength={noteMaxLength}
          rows={2}
          autoFocus
          aria-label="备注"
          className="w-full resize-none rounded-xl bg-app-card-subtle/70 px-2.5 py-1.5 text-xs text-text-main placeholder:text-text-tertiary focus:outline-none"
        />
      ) : (
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="点击填写备注"
          maxLength={noteMaxLength}
          aria-label="备注"
          className="w-full bg-transparent text-xs text-text-main placeholder:text-text-tertiary focus:outline-none"
        />
      )}

      <label className="sr-only">
        发生时间
        <input
          ref={timeInputRef}
          type="datetime-local"
          value={occurredAtInput}
          onChange={(event) => onOccurredAtChange(event.target.value)}
        />
      </label>
    </div>
  );
}
