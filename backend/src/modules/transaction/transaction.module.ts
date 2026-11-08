import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NoteSuggestionController } from './note-suggestion.controller';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  imports: [AuthModule],
  controllers: [TransactionController, NoteSuggestionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
