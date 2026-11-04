import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateLedgerPreferencesDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  currentLedgerId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  defaultLedgerId?: string;
}
