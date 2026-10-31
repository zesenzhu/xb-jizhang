import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

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
  isActive?: boolean;
}
