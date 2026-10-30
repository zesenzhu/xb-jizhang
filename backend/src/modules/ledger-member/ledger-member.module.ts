import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerMemberController } from './ledger-member.controller';
import { LedgerMemberService } from './ledger-member.service';

@Module({
  imports: [AuthModule],
  controllers: [LedgerMemberController],
  providers: [LedgerMemberService],
  exports: [LedgerMemberService],
})
export class LedgerMemberModule {}
