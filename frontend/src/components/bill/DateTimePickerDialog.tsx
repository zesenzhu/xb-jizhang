'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  buildMonthGrid,
  composeLocalDateTime,
  daysInMonth,
  parseLocalDateTime,
  type LocalDateTimeParts,
} from '@/lib/bill/datetime-picker';
import { cn } from '@/lib/utils';

export interface DateTimePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 账本时区下的 `YYYY-MM-DDTHH:mm` */
  value: string;
  onConfirm: (nextLocalValue: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

function initialParts(value: string): LocalDateTimeParts {
  const parsed = parseLocalDateTime(value);
  if (parsed) return parsed;
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

/**
 * 独立日期时间弹窗：叠加在记账面板之上，不依赖隐藏的原生 datetime-local。
 * 日历负责日期，两个 select 负责时/分；取消不回调，确认才提交。
 */
export function DateTimePickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: DateTimePickerDialogProps): React.JSX.Element {
  const [selected, setSelected] = React.useState<LocalDateTimeParts>(() => initialParts(value));
  const [cursor, setCursor] = React.useState(() => {
    const parts = initialParts(value);
    return { year: parts.year, month: parts.month };
  });

  const grid = buildMonthGrid(cursor.year, cursor.month);
  const maxDay = daysInMonth(cursor.year, cursor.month);

  const changeMonth = (delta: number): void => {
    const next = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() + 1 });
  };

  const chooseDay = (day: number): void => {
    setSelected((current) => ({
      ...current,
      year: cursor.year,
      month: cursor.month,
      day: Math.min(day, maxDay),
    }));
  };

  const confirm = (): void => {
    const next = composeLocalDateTime(selected);
    if (!next) return;
    onConfirm(next);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="选择日期和时间"
      footer={
        <>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" className="flex-1" onClick={confirm}>
            确认
          </Button>
        </>
      }
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="上一个月"
            onClick={() => changeMonth(-1)}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-900">
            {cursor.year}年{cursor.month}月
          </span>
          <button
            type="button"
            aria-label="下一个月"
            onClick={() => changeMonth(1)}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-1">{day}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((day, index) => {
            if (day === null) return <span key={`blank-${index}`} />;
            const active =
              selected.year === cursor.year &&
              selected.month === cursor.month &&
              selected.day === day;
            return (
              <button
                key={day}
                type="button"
                aria-label={`${cursor.year}年${cursor.month}月${day}日`}
                aria-pressed={active}
                onClick={() => chooseDay(day)}
                className={cn(
                  'flex h-9 items-center justify-center rounded-xl text-sm transition-colors',
                  active
                    ? 'bg-primary text-white'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-3">
          <label className="sr-only" htmlFor="date-hour">小时</label>
          <select
            id="date-hour"
            value={selected.hour}
            onChange={(event) =>
              setSelected((current) => ({ ...current, hour: Number(event.target.value) }))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-900"
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>{String(hour).padStart(2, '0')}</option>
            ))}
          </select>
          <span className="text-sm text-slate-500">:</span>
          <label className="sr-only" htmlFor="date-minute">分钟</label>
          <select
            id="date-minute"
            value={selected.minute}
            onChange={(event) =>
              setSelected((current) => ({ ...current, minute: Number(event.target.value) }))
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-base text-slate-900"
          >
            {Array.from({ length: 60 }, (_, minute) => (
              <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
