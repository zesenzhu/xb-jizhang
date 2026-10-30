import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  roleCodes?: string[];

  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsDateString()
  updatedAt!: string;
}
