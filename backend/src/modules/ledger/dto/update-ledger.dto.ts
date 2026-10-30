import { IsBoolean, IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateLedgerDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  color?: string | null;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsDateString()
  updatedAt!: string;
}
