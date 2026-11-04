import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class QueryStatisticsDto {
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
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  payerId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  keyword?: string;
}
