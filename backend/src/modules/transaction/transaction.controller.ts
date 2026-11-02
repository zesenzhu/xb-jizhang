import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TransactionService } from './transaction.service';
import type { CreateTransactionInput, TransactionQuery } from './transaction.types';

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

  @Get(':transactionId')
  getDetail(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.getDetail(user.id, ledgerId, transactionId);
  }
}
