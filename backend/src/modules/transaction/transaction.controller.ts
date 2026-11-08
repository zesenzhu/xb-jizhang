import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { DeleteTransactionDto } from './dto/delete-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { NoteSuggestionsQueryDto } from './dto/note-suggestions-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionService } from './transaction.service';
import type { CreateTransactionInput, TransactionQuery, UpdateTransactionInput } from './transaction.types';

@Controller('ledgers/:ledgerId/transactions')
@UseGuards(AuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryTransactionsDto,
  ) {
    return this.transactionService.list(user.id, ledgerId, query as TransactionQuery);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    const input: CreateTransactionInput = {
      clientRequestId: dto.clientRequestId,
      type: dto.type,
      amountCents: dto.amountCents,
      occurredAt: dto.occurredAt,
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      payerId: dto.payerId,
      title: dto.title,
      note: dto.note,
    };
    return this.transactionService.create(user.id, ledgerId, input);
  }

  @Patch(':transactionId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    const input: UpdateTransactionInput = {
      version: dto.version,
      type: dto.type,
      amountCents: dto.amountCents,
      occurredAt: dto.occurredAt,
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      payerId: dto.payerId,
      title: dto.title,
      note: dto.note,
    };
    return this.transactionService.update(user.id, ledgerId, transactionId, input);
  }

  @Delete(':transactionId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: DeleteTransactionDto,
  ) {
    return this.transactionService.remove(user.id, ledgerId, transactionId, dto.version);
  }

  @Get('note-suggestions')
  noteSuggestions(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: NoteSuggestionsQueryDto,
  ) {
    return this.transactionService.getNoteSuggestions(user.id, ledgerId, query.limit);
  }

  @Get(':transactionId')
  getDetail(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.getDetail(user.id, ledgerId, transactionId);
  }
}
