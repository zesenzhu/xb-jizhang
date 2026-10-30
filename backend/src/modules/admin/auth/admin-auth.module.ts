import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminPasswordService } from '../common/admin-password.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    AdminAuthGuard,
    AdminPasswordService,
    AdminPermissionService,
  ],
  exports: [AdminAuthService, AdminAuthGuard, AdminPermissionService, JwtModule],
})
export class AdminAuthModule {}
