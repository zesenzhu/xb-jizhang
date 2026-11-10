import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string | null;

  @IsOptional()
  @IsIn(['NONE', 'LIBRARY', 'IMAGE'])
  iconSource?: 'NONE' | 'LIBRARY' | 'IMAGE';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  iconKey?: string | null;

  @IsOptional()
  @IsUUID()
  iconAssetId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  color?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
