'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiRequestError } from '@/lib/api/errors';
import {
  getStatisticsCategories,
  getStatisticsOverview,
  getStatisticsPeriods,
  getStatisticsTrend,
} from '@/lib/api/statistics-api';
import type {
  CategoryData,
  CategoryItem,
  CategoryLevel,
  PeriodItem,
  StatisticsPeriod,
  StatisticsQuery,
  TrendItem,
  TrendMetric,
} from '@/lib/api/statistics-types';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { todayInZone, shiftAnchor } from '@/lib/statistics/range';
import { CategoryDonut, CategoryRow } from '@/components/statistics/CategoryDonut';
import { PeriodTable } from '@/components/statistics/PeriodTable';
import {
  OverviewCards,
  PeriodTabs,
  RangeNavigator,
} from '@/components/statistics/PeriodTabs';
import { TrendChart, TrendMetricTabs } from '@/components/statistics/TrendChart';

/**
 * 统计页。
 *
 * 四个模块共用一个 `scope`（时间范围 + 公共筛选），各自独立的 queryKey：
 * 趋势切指标、分类切类型都只影响自己那一块，不会连带刷新其他模块。
 *
 * 需求 9.2：切维度或范围时四块同时刷新且不保留旧数据 —— 靠共用 scope 实现。
 */
export function StatisticsPage(): React.JSX.Element {
  const ledgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const today = React.useMemo(() => todayInZone(), []);

  const [period, setPeriod] = React.useState<StatisticsPeriod>('MONTH');
  const [anchorDate, setAnchorDate] = React.useState(() => today);
  const [rangeStart, setRangeStart] = React.useState(() => today.slice(0, 8) + '01');
  const [rangeEnd, setRangeEnd] = React.useState(() => today);

  const [metric, setMetric] = React.useState<TrendMetric>('EXPENSE');
  const [categoryType, setCategoryType] = React.useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [categoryLevel, setCategoryLevel] = React.useState<CategoryLevel>('ROOT');
  const [categoryRootId, setCategoryRootId] = React.useState<string | null>(null);

  /**
   * 四个接口共用的时间上下文；切换维度时同时重置导航位置。
   *
   * 不使用 `as const`：各接口的查询类型由同一份 `StatisticsQuery` 派生，
   * 字面量联合会导致结构不兼容。
   */
  const scope = React.useMemo<StatisticsQuery | null>(() => {
    if (!ledgerId) return null;
    if (period === 'RANGE') return { period, fromDate: rangeStart, toDate: rangeEnd };
    if (period === 'ALL') return { period };
    return { period, anchorDate };
  }, [ledgerId, period, anchorDate, rangeStart, rangeEnd]);

  const handlePeriodChange = (next: StatisticsPeriod): void => {
    setPeriod(next);
    // 换维度时把导航拉回当前周期，避免在「年」视图里保留一个「月」锚点。
    setAnchorDate(today);
  };

  const overviewQuery = useQuery({
    queryKey: queryKeys.statistics.overview(ledgerId ?? '', scope!),
    queryFn: () => getStatisticsOverview(ledgerId ?? '', scope!),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(ledgerId && scope),
  });

  const trendQuery = useQuery({
    // metric 变化只改 valueCents，响应已含三个金额，所以键里不带 metric。
    queryKey: queryKeys.statistics.trend(ledgerId ?? '', scope!),
    queryFn: () => getStatisticsTrend(ledgerId ?? '', { ...scope!, metric }),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(ledgerId && scope),
  });

  const categoryQuery = useQuery({
    queryKey: queryKeys.statistics.categories(ledgerId ?? '', {
      ...(scope as StatisticsQuery),
      type: categoryType,
      categoryLevel,
      ...(categoryRootId ? { categoryRootId } : {}),
    }),
    queryFn: () =>
      getStatisticsCategories(ledgerId ?? '', {
        ...scope!,
        type: categoryType,
        categoryLevel,
        ...(categoryRootId ? { categoryRootId } : {}),
      }),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(ledgerId && scope),
  });

  const periodQuery = useQuery({
    queryKey: queryKeys.statistics.periods(ledgerId ?? '', scope!),
    queryFn: () => getStatisticsPeriods(ledgerId ?? '', scope!),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(ledgerId && scope),
  });

  if (!ledgerId) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm text-text-muted">请先选择账本</p>
      </main>
    );
  }

  const overview = overviewQuery.data;
  const granularity = overview?.range.granularity ?? 'DAY';

  return (
    <main className="mx-auto max-w-md space-y-3 px-4 py-3">
      <PeriodTabs value={period} onChange={handlePeriodChange} />

      <RangeNavigator
        period={period}
        anchorDate={anchorDate}
        today={today}
        onShift={(delta) => setAnchorDate((value) => shiftAnchor(period, value, delta))}
      />

      {period === 'RANGE' && (
        <RangeInputs
          start={rangeStart}
          end={rangeEnd}
          max={today}
          onChange={(start, end) => {
            setRangeStart(start);
            setRangeEnd(end);
          }}
        />
      )}

      <Section
        title="收支统计"
        loading={overviewQuery.isPending}
        error={errorText(overviewQuery.error)}
        onRetry={() => void overviewQuery.refetch()}
      >
        {overview && (
          <OverviewCards
            totalExpenseCents={overview.totalExpenseCents}
            totalIncomeCents={overview.totalIncomeCents}
            netCents={overview.netCents}
            averageDailyExpenseCents={overview.averageDailyExpenseCents}
          />
        )}
      </Section>

      <Section
        title="收支趋势"
        headerExtra={
          <TrendMetricTabs
            value={metric}
            onChange={setMetric}
            granulatingLabel={granularityLabel(granularity)}
          />
        }
        loading={trendQuery.isPending}
        error={errorText(trendQuery.error)}
        onRetry={() => void trendQuery.refetch()}
      >
        {trendQuery.data && (
          <TrendChart
            items={trendQuery.data.items}
            metric={metric}
            granularity={trendQuery.data.range.granularity}
            hasData={trendQuery.data.hasData}
          />
        )}
      </Section>

      <Section
        title="分类统计"
        headerExtra={
          <div className="flex rounded-full bg-app-card-subtle p-0.5">
            {(['EXPENSE', 'INCOME'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setCategoryType(type);
                  // 换类型要退出下钻：一级分类属于上一个类型，继续用会 404。
                  setCategoryRootId(null);
                  setCategoryLevel('ROOT');
                }}
                aria-pressed={categoryType === type}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  categoryType === type
                    ? 'bg-app-card text-text-main shadow-xs'
                    : 'text-text-muted',
                )}
              >
                {type === 'EXPENSE' ? '支出' : '收入'}
              </button>
            ))}
          </div>
        }
        loading={categoryQuery.isPending}
        error={errorText(categoryQuery.error)}
        onRetry={() => void categoryQuery.refetch()}
      >
        {categoryQuery.data && (
          <CategorySection
            data={categoryQuery.data}
            level={categoryLevel}
            onDrillDown={(option) => {
              setCategoryLevel('CHILD');
              setCategoryRootId(option.id);
            }}
            onBackToRoot={() => {
              setCategoryLevel('ROOT');
              setCategoryRootId(null);
            }}
          />
        )}
      </Section>

      <Section
        title="账单汇总"
        loading={periodQuery.isPending}
        error={errorText(periodQuery.error)}
        onRetry={() => void periodQuery.refetch()}
      >
        {periodQuery.data && (
          <PeriodTable
            summary={periodQuery.data.summary}
            items={periodQuery.data.items}
            granularity={periodQuery.data.range.granularity}
          />
        )}
      </Section>
    </main>
  );
}

/** 分类模块：ROOT 平铺，CHILD 时给出返回一级的入口。 */
function CategorySection({
  data,
  level,
  onDrillDown,
  onBackToRoot,
}: {
  data: CategoryData;
  level: CategoryLevel;
  onDrillDown: (option: { id: string; name: string }) => void;
  onBackToRoot: () => void;
}): React.JSX.Element {
  const isExpense = data.type === 'EXPENSE';

  return (
    <div>
      {level === 'CHILD' && (
        <button
          type="button"
          onClick={onBackToRoot}
          className="mb-2 flex items-center gap-1 px-1 text-[11px] font-semibold text-primary"
        >
          ‹ 返回一级分类
        </button>
      )}

      <CategoryDonut items={data.items} totalCents={data.totalCents} isExpense={isExpense} />

      <div className="mt-2 divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border">
        {data.items.map((item, index) => (
          <CategoryRow
            key={item.categoryId ?? `bucket-${item.bucketType}-${index}`}
            item={item}
            isExpense={isExpense}
            onClick={() => {
              // 一级分类（非 ROOT_DIRECT、非未分类）可继续下钻到二级。
              if (
                level === 'ROOT' &&
                item.bucketType === 'CATEGORY' &&
                item.categoryId &&
                !item.parentId
              ) {
                onDrillDown({ id: item.categoryId, name: item.name });
              }
            }}
          />
        ))}
        {data.items.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-text-tertiary">当前范围内没有分类数据</p>
        )}
      </div>
    </div>
  );
}

function RangeInputs({
  start,
  end,
  max,
  onChange,
}: {
  start: string;
  end: string;
  max: string;
  onChange: (start: string, end: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-1">
      <input
        type="date"
        value={start}
        max={end}
        aria-label="起始日期"
        onChange={(event) => event.target.value && onChange(event.target.value, end)}
        className="min-w-0 flex-1 rounded-xl border border-app-border bg-app-card-subtle/70 px-2 py-1.5 text-xs text-text-main"
      />
      <span className="text-xs text-text-tertiary">至</span>
      <input
        type="date"
        value={end}
        min={start}
        max={max}
        aria-label="结束日期"
        onChange={(event) => event.target.value && onChange(start, event.target.value)}
        className="min-w-0 flex-1 rounded-xl border border-app-border bg-app-card-subtle/70 px-2 py-1.5 text-xs text-text-main"
      />
    </div>
  );
}

function Section({
  title,
  headerExtra,
  loading,
  error,
  onRetry,
  children,
}: {
  title: string;
  headerExtra?: React.ReactNode;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-3xl border border-app-border bg-app-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-main">{title}</h2>
        {headerExtra}
      </div>

      {loading && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-16 animate-pulse rounded-2xl bg-app-card-subtle" />
          <div className="h-10 animate-pulse rounded-2xl bg-app-card-subtle" />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-xs text-rose-500">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded-full border border-app-border px-3 py-1 text-[11px] text-text-main"
          >
            <RefreshCw size={11} />
            重试
          </button>
        </div>
      )}

      {!loading && !error && children}
    </section>
  );
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) {
    if (error.code === 40021) return '统计参数不合法';
    if (error.code === 40022) return '时间范围过大，请缩小范围';
    if (error.code === 40023) return '分类参数冲突';
    if (error.code === 40421) return '账本或分类不可见';
    return error.message;
  }
  return '统计加载失败，请稍后重试';
}

function granularityLabel(granularity: 'DAY' | 'MONTH' | 'YEAR'): string {
  if (granularity === 'MONTH') return '按月';
  if (granularity === 'YEAR') return '按年';
  return '按日';
}

export type { CategoryItem, PeriodItem, TrendItem };
