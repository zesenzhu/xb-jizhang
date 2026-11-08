'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoteSuggestion } from '@/lib/api/transaction-types';
import { NoteSuggestionBar } from './NoteSuggestionBar';
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
  /** 文本编辑态：交由面板决定是否把底部区抬到键盘上缘 */
  onEditingChange?: (editing: boolean) => void;
}

/**
 * 金额卡内的第二行：时间 + 商家/备注 + 展开。
 *
 * 输入就在原位完成：点击后由系统键盘接管，面板本身不增高；
 * 备注聚焦时在上方浮出历史候选，选完继续在原输入框里编辑，不需要额外确认。
 * 字号保持设计值，iOS 的聚焦放大由 viewport 的 maximum-scale 抑制。
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
  onEditingChange,
}: SheetMetaFieldsProps): React.JSX.Element {
  const [noteFocused, setNoteFocused] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  /** 候选被点按时保持输入焦点：阻止默认按下行为，避免先 blur 再点导致候选消失。 */
  const keepFocus = (event: React.MouseEvent | React.TouchEvent): void => {
    event.preventDefault();
  };

  const showSuggestions = noteFocused && suggestions.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            setNoteFocused(false);
            onEditingChange?.(false);
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
          onChange={(event) => onTitleChange(event.target.value)}
          onFocus={() => onEditingChange?.(true)}
          onBlur={() => onEditingChange?.(false)}
          placeholder="商家 / 对象"
          maxLength={200}
          aria-label="商家或对象"
          className="min-w-0 flex-1 bg-transparent text-xs text-text-main placeholder:text-text-tertiary focus:outline-none"
        />
      </div>

      {/*
        历史备注：位置固定占位，只在有候选时填充内容。
        之前是「有候选才插入一行」，聚焦瞬间把下方的备注输入顶下去，
        iOS 会在键盘动画期间判定焦点元素被移走而收起键盘——表现为“一打字键盘就关”。
      */}
      <div className="min-h-[34px]" onMouseDown={keepFocus} onTouchStart={keepFocus}>
        {showSuggestions && (
          <NoteSuggestionBar
            suggestions={suggestions}
            onSelect={(text) => {
              onNoteChange(text);
              onSelectSuggestion?.(text);
            }}
          />
        )}
      </div>

      {/*
        备注始终是同一个 input：不按状态换控件、也不展开成多行。
        换控件会卸载节点导致焦点丢失，系统键盘随即收起——表现为「点了没反应」「键盘弹上弹下」。
      */}
      <input
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        onFocus={() => {
          setNoteFocused(true);
          onEditingChange?.(true);
        }}
        onBlur={() => {
          setNoteFocused(false);
          onEditingChange?.(false);
        }}
        placeholder="点击填写备注"
        maxLength={noteMaxLength}
        aria-label="备注"
        className="w-full bg-transparent text-xs text-text-main placeholder:text-text-tertiary focus:outline-none"
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
