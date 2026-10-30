import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class QueryAdminAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsUUID()
  adminUserId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  action?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  targetType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  targetId?: string;

  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE'])
  result?: 'SUCCESS' | 'FAILURE';

  @IsOptional()
  @IsString()
  @Length(1, 128)
  requestId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
