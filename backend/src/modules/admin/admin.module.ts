import { Module } from '@nestjs/common';
import { AdminAuditModule } from './audit/admin-audit.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminLedgerModule } from './ledger/admin-ledger.module';
import { AdminUserModule } from './admin-user/admin-user.module';
import { AdminUserManagementModule } from './user-management/admin-user-management.module';

@Module({
  imports: [
    AdminAuthModule,
    AdminAuditModule,
    AdminUserModule,
    AdminUserManagementModule,
    AdminLedgerModule,
  ],
})
export class AdminModule {}
