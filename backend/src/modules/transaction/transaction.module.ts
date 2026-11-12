import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoryIconModule } from '../category-icon/category-icon.module';
import { NoteSuggestionController } from './note-suggestion.controller';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  imports: [AuthModule, CategoryIconModule],
  controllers: [TransactionController, NoteSuggestionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
