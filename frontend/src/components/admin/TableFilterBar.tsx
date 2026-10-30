'use client';

import * as React from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

export interface TableFilterBarProps {
  /** 搜索关键词 */
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  keywordPlaceholder?: string;
  /** 状态筛选配置 */
  statusOptions?: FilterOption[];
  statusValue?: string;
  onStatusChange?: (status: string) => void;
  statusPlaceholder?: string;
  /** 搜索与重置回调 */
  onSearch: () => void;
  onReset: () => void;
  isLoading?: boolean;
  extraActions?: React.ReactNode;
  className?: string;
}

export function TableFilterBar({
  keyword,
  onKeywordChange,
  keywordPlaceholder = '按用户名、邮箱或 ID 搜索...',
  statusOptions,
  statusValue,
  onStatusChange,
  statusPlaceholder = '全部状态',
  onSearch,
  onReset,
  isLoading = false,
  extraActions,
  className,
}: TableFilterBarProps): React.JSX.Element {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* 关键词搜索框 */}
        <div className="w-full sm:max-w-xs">
          <Input
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={keywordPlaceholder}
            startIcon={<Search size={16} />}
            disabled={isLoading}
          />
        </div>

        {/* 状态下拉（原生无样式轻量封装） */}
        {statusOptions && onStatusChange && (
          <div className="w-full sm:w-36">
            <select
              value={statusValue ?? ''}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">{statusPlaceholder}</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 查询与重置按钮 */}
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onSearch} isLoading={isLoading}>
            查询
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isLoading}
            className="gap-1 text-slate-600"
          >
            <RotateCcw size={13} />
            重置
          </Button>
        </div>
      </div>

      {/* 右侧扩展操作区（如新增管理员、导出日志等） */}
      {extraActions && <div className="flex items-center gap-2">{extraActions}</div>}
    </div>
  );
}

