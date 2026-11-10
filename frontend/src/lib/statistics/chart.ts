/**
 * 趋势图与环形图的几何计算。
 *
 * 抽成纯函数的原因：SVG 里算错一个坐标不会报错，只会画出难看的图，
 * 只有把「值 → 高度」「值 → 弧长」这些映射独立出来才能被测试钉住。
 */

export interface TrendPoint {
  /** 与 items 一一对应的百分比高度，0-100 */
  heightPercent: number;
  /** 该周期是否有数据，用于空周期着色 */
  isEmpty: boolean;
}

/**
 * 把趋势值映射为柱高百分比。
 *
 * - 全部为 0：所有柱高 0，靠调用方的空状态处理，不虚构高度
 * - 存在负值（结余为负时）：以 0 为基线，向上画正值、向下画负值
 */
export function toTrendPoints(values: readonly number[]): TrendPoint[] {
  if (values.length === 0) return [];

  const max = Math.max(...values.map((value) => Math.abs(value)));
  if (max === 0) {
    return values.map(() => ({ heightPercent: 0, isEmpty: true }));
  }

  return values.map((value) => ({
    heightPercent: Math.round((Math.abs(value) / max) * 100),
    isEmpty: value === 0,
  }));
}

/** 趋势是否包含负值（决定是否需要用零基线双向绘制）。 */
export function hasNegative(values: readonly number[]): boolean {
  return values.some((value) => value < 0);
}

export interface DonutSegment {
  /** 该扇区的起始比例 0-1 */
  offset: number;
  /** 该扇区占圆周的比例 0-1 */
  ratio: number;
}

import type { CategoryChartItem, CategoryItem } from '@/lib/api/statistics-types';

/**
 * 环形图最多显示前 N 项，其余合并为“其他”。
 * 该结果只用于展示：聚合项没有真实 categoryId，也没有下钻信息。
 */
export function aggregateCategoryChartItems(
  items: readonly CategoryItem[],
  maxItems = 8,
): CategoryChartItem[] {
  if (maxItems < 1) return [];

  const positiveItems = items.filter((item) => item.amountCents > 0);
  if (positiveItems.length === 0) return [];

  const visible = positiveItems.slice(0, maxItems);
  const rest = positiveItems.slice(maxItems);
  const totalCents = positiveItems.reduce((sum, item) => sum + item.amountCents, 0);
  const normalize = (item: CategoryItem): CategoryChartItem => ({
    ...item,
    percentage: totalCents > 0 ? (item.amountCents / totalCents) * 100 : 0,
  });
  const result = visible.map(normalize);

  if (rest.length === 0) return result;

  const amountCents = rest.reduce((sum, item) => sum + item.amountCents, 0);
  const transactionCount = rest.reduce((sum, item) => sum + item.transactionCount, 0);
  const comparisons = rest.flatMap((item) => (item.comparison ? [item.comparison] : []));
  const comparison = comparisons.length
    ? {
        amountCents: comparisons.reduce((sum, item) => sum + item.amountCents, 0),
        amountDeltaCents: comparisons.reduce((sum, item) => sum + item.amountDeltaCents, 0),
        percentagePointDelta: comparisons.every((item) => item.percentagePointDelta === null)
          ? null
          : comparisons.reduce(
              (sum, item) => sum + (item.percentagePointDelta ?? 0),
              0,
            ),
      }
    : null;

  result.push({
    categoryId: null,
    categoryRootId: null,
    parentId: null,
    bucketType: 'OTHER',
    name: '其他',
    icon: null,
    color: '#94a3b8',
    iconSource: 'NONE',
    iconKey: null,
    iconAssetId: null,
    iconUrl: null,
    iconUrlExpiresAt: null,
    amountCents,
    percentage: totalCents > 0 ? (amountCents / totalCents) * 100 : 0,
    transactionCount,
    comparison,
    drilldown: null,
  });

  return result;
}

/**
 * 环形图扇区。
 *
 * 用 `stroke-dasharray` + `stroke-dashoffset` 绘制：
 * 每个环的长度是 1，`ratio` 决定线段长度，`offset` 是它在圆周上的起点。
 * 传入的 `percentages` 来自服务端，可能因四舍五入总和不为 100，
 * 这里按总和归一，保证最后一扇区正好闭合。
 */
export function toDonutSegments(percentages: readonly number[]): DonutSegment[] {
  const total = percentages.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  let cursor = 0;
  return percentages.map((value) => {
    const ratio = value / total;
    const segment = { offset: cursor, ratio };
    cursor += ratio;
    return segment;
  });
}

/** 百分比展示：保留两位小数，去掉多余的 0。 */
export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}%`;
}

/**
 * 汇总表格的行标签。
 *
 * 日粒度 `11月1日`；月粒度 `2026年11月`；年粒度 `2026年`。
 * 跨年时月和日要带年份，避免出现两个「11月1日」。
 */
export function formatPeriodLabel(
  fromDate: string,
  toDate: string,
  granularity: 'DAY' | 'MONTH' | 'YEAR',
): string {
  const [year, month, day] = fromDate.split('-').map(Number);

  if (granularity === 'YEAR') return `${year}年`;
  if (granularity === 'MONTH') {
    const endYear = Number(toDate.slice(0, 4));
    const endMonth = Number(toDate.slice(5, 7));
    // 部分周期（首尾被裁剪）时显示实际起止
    if (endYear === year && endMonth === month) return `${year}年${month}月`;
    return `${year}年${month}月 - ${endMonth}月`;
  }

  const endDay = Number(toDate.slice(8, 10));
  const endMonth = Number(toDate.slice(5, 7));
  const endYear = Number(toDate.slice(0, 4));
  if (fromDate === toDate) return `${month}月${day}日`;
  if (endYear !== year) return `${year}年${month}月${day}日 - ${endYear}年${endMonth}月${endDay}日`;
  if (endMonth !== month) return `${month}月${day}日 - ${endMonth}月${endDay}日`;
  return `${month}月${day}日 - ${endDay}日`;
}

/** 金额紧凑格式：图表轴与柱顶用，万/亿以上缩写。 */
export function formatCompactYuan(cents: number): string {
  const yuan = cents / 100;
  const absolute = Math.abs(yuan);
  const sign = yuan < 0 ? '-' : '';

  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toFixed(1)}亿`;
  if (absolute >= 10_000) return `${sign}${(absolute / 10_000).toFixed(1)}万`;
  return `${sign}${absolute.toFixed(0)}`;
}
