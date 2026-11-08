import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { NoteSuggestionsQueryDto } from './dto/note-suggestions-query.dto';
import { TransactionService } from './transaction.service';

/**
 * 历史备注候选控制器：对齐 API 文档 `GET /api/ledgers/:ledgerId/note-suggestions` 规范。
 */
@Controller('ledgers/:ledgerId/note-suggestions')
@UseGuards(AuthGuard)
export class NoteSuggestionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  noteSuggestions(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: NoteSuggestionsQueryDto,
  ) {
    return this.transactionService.getNoteSuggestions(user.id, ledgerId, query.limit);
  }
}

