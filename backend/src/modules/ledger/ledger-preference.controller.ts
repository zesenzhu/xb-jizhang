import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateLedgerPreferencesDto } from './dto/update-ledger-preferences.dto';
import { LedgerPreferenceService } from './ledger-preference.service';
import type { UpdateLedgerPreferencesInput } from './ledger-preference.types';

@Controller('me/ledger-preferences')
@UseGuards(AuthGuard)
export class LedgerPreferenceController {
  constructor(private readonly ledgerPreferenceService: LedgerPreferenceService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.ledgerPreferenceService.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateLedgerPreferencesDto) {
    const input: UpdateLedgerPreferencesInput = {
      currentLedgerId: dto.currentLedgerId,
      defaultLedgerId: dto.defaultLedgerId,
    };
    return this.ledgerPreferenceService.update(user.id, input);
  }
}
