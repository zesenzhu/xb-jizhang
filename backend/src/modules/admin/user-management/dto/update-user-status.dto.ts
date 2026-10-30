import { IsDateString, IsIn, IsString, Length } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';

  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsDateString()
  updatedAt!: string;
}
