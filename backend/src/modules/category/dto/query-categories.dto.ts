import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryCategoriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: 'EXPENSE' | 'INCOME';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive = false;
}
