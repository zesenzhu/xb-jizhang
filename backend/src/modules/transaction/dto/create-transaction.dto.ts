import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  clientRequestId!: string;

  @IsIn(['EXPENSE', 'INCOME'])
  type!: 'EXPENSE' | 'INCOME';

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsISO8601()
  occurredAt!: string;

  @IsUUID()
  categoryId!: string;

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
