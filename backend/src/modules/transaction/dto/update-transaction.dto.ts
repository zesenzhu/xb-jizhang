import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class UpdateTransactionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: 'EXPENSE' | 'INCOME';

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsUUID()
  payerId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  note?: string | null;
}
