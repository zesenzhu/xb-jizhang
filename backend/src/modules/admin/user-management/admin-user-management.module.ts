import { Module } from '@nestjs/common';
import { AdminAuditModule } from '../audit/admin-audit.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminUserManagementController } from './admin-user-management.controller';
import { AdminUserManagementService } from './admin-user-management.service';

@Module({
  imports: [AdminAuthModule, AdminAuditModule],
  controllers: [AdminUserManagementController],
  providers: [AdminUserManagementService],
})
export class AdminUserManagementModule {}
