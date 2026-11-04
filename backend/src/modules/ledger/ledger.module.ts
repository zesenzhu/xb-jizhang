import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerPreferenceController } from './ledger-preference.controller';
import { LedgerPreferenceService } from './ledger-preference.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

@Module({
  imports: [AuthModule],
  controllers: [LedgerController, LedgerPreferenceController],
  providers: [LedgerService, LedgerPreferenceService],
  exports: [LedgerService, LedgerPreferenceService],
})
export class LedgerModule {}
