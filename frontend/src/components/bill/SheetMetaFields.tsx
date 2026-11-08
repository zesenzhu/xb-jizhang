'use client';

import * as React from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoteSuggestion } from '@/lib/api/transaction-types';
import { NoteComposerDock, type NoteComposerField } from './NoteComposerDock';
import { DateTimePickerDialog } from './DateTimePickerDialog';

export interface SheetMetaFieldsProps {
  /** 账本时区下的 datetime-local 值，格式 `YYYY-MM-DDTHH:mm` */
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
  suggestions?: readonly NoteSuggestion[];
  onSelectSuggestion?: (text: string) => void;
  onSave?: () => void;
  saveDisabled?: boolean;
}

/**
 * 金额卡内的第二行：时间 + 商家/备注 + 展开。
 *
 * 输入不再直接聚焦原生控件：点击后打开键盘上方的编辑条，
 * 避免 iOS 聚焦小字号输入框自动放大，也避免系统键盘把面板顶起。
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
  suggestions = [],
  onSelectSuggestion,
  onSave,
  saveDisabled,
}: SheetMetaFieldsProps): React.JSX.Element {
  const [noteExpanded, setNoteExpanded] = React.useState(false);
  const [composerField, setComposerField] = React.useState<NoteComposerField | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const openComposer = (field: NoteComposerField): void => {
    setComposerField(field);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setComposerField(null);
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            setPickerOpen(true);
          }}
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
          readOnly
          onClick={() => openComposer('title')}
          onFocus={(event) => {
            event.currentTarget.blur();
            openComposer('title');
          }}
          placeholder="商家 / 对象"
          maxLength={200}
          aria-label="商家或对象"
          className="min-w-0 flex-1 bg-transparent text-base text-text-main placeholder:text-text-tertiary focus:outline-none"
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

      {/* 备注：单行 ⇄ 多行，点击后统一进入键盘上方编辑条。 */}
      {noteExpanded ? (
        <textarea
          value={note}
          readOnly
          onClick={() => openComposer('note')}
          onFocus={(event) => {
            event.currentTarget.blur();
            openComposer('note');
          }}
          placeholder="点击填写备注"
          rows={2}
          aria-label="备注"
          className="w-full resize-none rounded-xl bg-app-card-subtle/70 px-2.5 py-1.5 text-base text-text-main placeholder:text-text-tertiary focus:outline-none"
        />
      ) : (
        <input
          value={note}
          readOnly
          onClick={() => openComposer('note')}
          onFocus={(event) => {
            event.currentTarget.blur();
            openComposer('note');
          }}
          placeholder="点击填写备注"
          maxLength={noteMaxLength}
          aria-label="备注"
          className="w-full bg-transparent text-base text-text-main placeholder:text-text-tertiary focus:outline-none"
        />
      )}

      <NoteComposerDock
        open={composerField !== null}
        field={composerField ?? 'note'}
        value={composerField === 'title' ? title : note}
        noteMaxLength={noteMaxLength}
        suggestions={suggestions}
        onChange={(value) => {
          if (composerField === 'title') onTitleChange(value);
          else onNoteChange(value);
        }}
        onClose={() => setComposerField(null)}
        onSave={onSave}
        saveDisabled={saveDisabled}
      />

      {pickerOpen && (
        <DateTimePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          value={occurredAtInput}
          onConfirm={onOccurredAtChange}
        />
      )}
    </div>
  );
}
