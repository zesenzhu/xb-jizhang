import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsIn(['CASH', 'BANK_CARD', 'CREDIT_CARD', 'ALIPAY', 'WECHAT', 'OTHER'])
  type!: 'CASH' | 'BANK_CARD' | 'CREDIT_CARD' | 'ALIPAY' | 'WECHAT' | 'OTHER';

  @IsIn(['SHARED', 'PRIVATE'])
  visibility!: 'SHARED' | 'PRIVATE';

  @IsOptional()
  @IsInt()
  @Min(0)
  initialBalanceCents?: number;

  @IsOptional()
  @IsBoolean()
  includeInAssets?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  color?: string | null;
}
