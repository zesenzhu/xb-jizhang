'use client';

import * as React from 'react';
import type { NoteSuggestion } from '@/lib/api/transaction-types';

export interface NoteSuggestionBarProps {
  suggestions: readonly NoteSuggestion[];
  onSelect: (text: string) => void;
}

/**
 * 备注历史候选：只负责展示和回填，不触发提交。
 * 横向滚动而不是换行，避免候选数量把金额卡和键盘挤出可视区域。
 */
export function NoteSuggestionBar({
  suggestions,
  onSelect,
}: NoteSuggestionBarProps): React.JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="历史备注候选"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.text}
          type="button"
          onClick={() => onSelect(suggestion.text)}
          className="shrink-0 rounded-full border border-app-border bg-app-card px-2.5 py-1 text-[11px] text-text-muted active:scale-95"
        >
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}
