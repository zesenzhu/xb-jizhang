'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVisualViewport } from '@/lib/viewport/use-visual-viewport';
import type { NoteSuggestion } from '@/lib/api/transaction-types';
import { NoteSuggestionBar } from './NoteSuggestionBar';

export type NoteComposerField = 'title' | 'note';

export interface NoteComposerDockProps {
  open: boolean;
  field: NoteComposerField;
  value: string;
  noteMaxLength: number;
  suggestions: readonly NoteSuggestion[];
  onChange: (value: string) => void;
  onClose: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
}

/**
 * 商家/备注编辑条：系统键盘覆盖在记账面板之上，面板本身不增高；
 * 编辑条固定在键盘上缘，保证输入框、候选和完成按钮始终可达。
 */
export function NoteComposerDock({
  open,
  field,
  value,
  noteMaxLength,
  suggestions,
  onChange,
  onClose,
  onSave,
  saveDisabled = false,
}: NoteComposerDockProps): React.JSX.Element | null {
  const { keyboardInset } = useVisualViewport();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      textareaRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const finish = (): void => {
    inputRef.current?.blur();
    textareaRef.current?.blur();
    onClose();
  };

  const maxLength = field === 'title' ? 200 : noteMaxLength;

  return createPortal(
    <div
      className="fixed inset-x-0 z-[65] mx-auto w-full max-w-md px-3"
      style={{ bottom: `${keyboardInset + 8}px` }}
      role="dialog"
      aria-label={field === 'title' ? '编辑商家或对象' : '编辑备注'}
    >
      <div className="rounded-2xl border border-app-border bg-app-card p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-text-muted">
            {field === 'title' ? '商家 / 对象' : '备注'}
          </span>
          <div className="flex items-center gap-1">
            {onSave && (
              <Button
                type="button"
                size="sm"
                disabled={saveDisabled}
                onClick={() => {
                  finish();
                  onSave();
                }}
              >
                保存账单
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={finish}>
              完成
            </Button>
          </div>
        </div>

        {field === 'note' && (
          <NoteSuggestionBar
            suggestions={suggestions}
            onSelect={(text) => onChange(text)}
          />
        )}

        {field === 'title' ? (
          <Input
            ref={inputRef}
            value={value}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            placeholder="商家 / 对象"
            className="h-11 text-base"
            aria-label="商家或对象"
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            placeholder="点击填写备注"
            rows={3}
            className="w-full resize-none rounded-xl border border-app-border bg-app-card px-3 py-2 text-base text-text-main placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="备注"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
