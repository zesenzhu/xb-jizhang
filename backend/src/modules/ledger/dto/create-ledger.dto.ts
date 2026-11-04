import { IsIn, IsOptional, IsString, IsTimeZone, Length } from 'class-validator';

export class CreateLedgerDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsIn(['PERSONAL', 'SHARED'])
  type!: 'PERSONAL' | 'SHARED';

  @IsOptional()
  @IsString()
  @IsIn(Intl.supportedValuesOf('currency'))
  defaultCurrency?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  color?: string | null;
}
