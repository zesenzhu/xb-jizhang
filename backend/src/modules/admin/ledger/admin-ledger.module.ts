import { Module } from '@nestjs/common';
import { AdminAuditModule } from '../audit/admin-audit.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';

@Module({
  imports: [AdminAuthModule, AdminAuditModule],
  controllers: [AdminLedgerController],
  providers: [AdminLedgerService],
})
export class AdminLedgerModule {}
