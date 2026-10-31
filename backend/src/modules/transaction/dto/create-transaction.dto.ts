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

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  payerId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  note?: string | null;
}
