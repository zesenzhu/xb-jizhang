import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  includeInAssets?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  color?: string | null;
}
