import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateLedgerDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsIn(['PERSONAL', 'SHARED'])
  type!: 'PERSONAL' | 'SHARED';

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  color?: string | null;
}
