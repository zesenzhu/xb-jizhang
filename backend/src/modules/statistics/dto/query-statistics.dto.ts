import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator';
import type { StatisticsDateRangeQuery } from '../statistics.types';

const periods = ['WEEK', 'MONTH', 'YEAR', 'ALL', 'RANGE'] as const;
const granularities = ['AUTO', 'DAY', 'MONTH', 'YEAR'] as const;

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function isValidPeriodContract(
  value: unknown,
  args: ValidationArguments,
): boolean {
  const query = args.object as StatisticsDateRangeQuery & {
    from?: string;
    to?: string;
  };
  if (value === undefined || value === null) {
    return ![
      query.anchorDate,
      query.fromDate,
      query.toDate,
      query.granularity,
    ].some(hasValue);
  }
  if (
    !periods.includes(value as (typeof periods)[number]) ||
    hasValue(query.from) ||
    hasValue(query.to)
  ) {
    return false;
  }

  const hasAnchor = hasValue(query.anchorDate);
  const hasFromDate = hasValue(query.fromDate);
  const hasToDate = hasValue(query.toDate);
  const period = value as (typeof periods)[number];
  const validDates =
    period === 'WEEK' || period === 'MONTH' || period === 'YEAR'
      ? hasAnchor && !hasFromDate && !hasToDate
      : period === 'RANGE'
        ? !hasAnchor && hasFromDate && hasToDate
        : !hasAnchor && !hasFromDate && !hasToDate;
  if (!validDates) return false;

  const granularity = query.granularity;
  if (!hasValue(granularity)) return true;
  if (!granularities.includes(granularity as (typeof granularities)[number]))
    return false;
  if (granularity === 'AUTO') return true;
  if (period === 'WEEK') return granularity === 'DAY';
  if (period === 'MONTH')
    return granularity === 'DAY' || granularity === 'MONTH';
  if (period === 'ALL') return granularity === 'YEAR';
  return true;
}

function isCategoryFilterExclusive(
  value: unknown,
  args: ValidationArguments,
): boolean {
  return (
    !hasValue(value) ||
    (!hasValue((args.object as { categoryId?: string }).categoryId) &&
      (args.object as { uncategorized?: boolean }).uncategorized !== true)
  );
}

function isUncategorizedFilterExclusive(
  value: unknown,
  args: ValidationArguments,
): boolean {
  if (value !== true) return true;
  const query = args.object as { categoryId?: string; categoryRootId?: string };
  return !hasValue(query.categoryId) && !hasValue(query.categoryRootId);
}

export class QueryStatisticsDto {
  @ValidateBy({
    name: 'statisticsPeriodContract',
    validator: { validate: isValidPeriodContract },
  })
  period?: StatisticsDateRangeQuery['period'];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true, strictSeparator: true })
  anchorDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true, strictSeparator: true })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true, strictSeparator: true })
  toDate?: string;

  @IsOptional()
  @IsIn(granularities)
  granularity?: StatisticsDateRangeQuery['granularity'];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: 'EXPENSE' | 'INCOME';

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME', 'NET'])
  metric?: 'EXPENSE' | 'INCOME' | 'NET';

  @IsOptional()
  @IsIn(['ROOT', 'CHILD'])
  categoryLevel?: 'ROOT' | 'CHILD';

  @IsOptional()
  @IsIn(['AMOUNT', 'PERCENTAGE'])
  sortBy?: 'AMOUNT' | 'PERCENTAGE';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeComparison?: boolean;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @ValidateBy({
    name: 'uncategorizedFilterExclusive',
    validator: { validate: isUncategorizedFilterExclusive },
  })
  uncategorized?: boolean;

  @IsOptional()
  @IsUUID()
  @ValidateBy({
    name: 'categoryFilterExclusive',
    validator: { validate: isCategoryFilterExclusive },
  })
  categoryRootId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  payerId?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  keyword?: string;
}
