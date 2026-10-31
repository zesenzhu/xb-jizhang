import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CategoryModule } from './modules/category/category.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { AuthModule } from './modules/auth/auth.module';
import { AccountModule } from './modules/account/account.module';
import { AdminModule } from './modules/admin/admin.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { LedgerMemberModule } from './modules/ledger-member/ledger-member.module';
import { InvitationModule } from './modules/invitation/invitation.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AccountModule,
    CategoryModule,
    AdminModule,
    LedgerModule,
    LedgerMemberModule,
    InvitationModule,
    UserModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
