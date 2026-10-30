import { IsDateString, IsIn, IsString, Length } from 'class-validator';

export class UpdateLedgerStatusDto {
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status!: 'ACTIVE' | 'ARCHIVED';

  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsDateString()
  updatedAt!: string;
}
