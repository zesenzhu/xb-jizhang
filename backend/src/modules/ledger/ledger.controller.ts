import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CreateLedgerDto } from './dto/create-ledger.dto';
import { QueryLedgersDto } from './dto/query-ledgers.dto';
import { UpdateLedgerDto } from './dto/update-ledger.dto';
import { LedgerService } from './ledger.service';
import type { CreateLedgerInput, LedgerQuery, UpdateLedgerInput } from './ledger.types';

@Controller('ledgers')
@UseGuards(AuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryLedgersDto) {
    return this.ledgerService.list(user.id, query as LedgerQuery);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLedgerDto) {
    const input: CreateLedgerInput = {
      name: dto.name,
      type: dto.type,
      defaultCurrency: dto.defaultCurrency,
      timezone: dto.timezone,
      icon: dto.icon,
      color: dto.color,
    };
    return this.ledgerService.create(user.id, input);
  }

  @Get(':ledgerId')
  getDetail(@CurrentUser() user: AuthUser, @Param('ledgerId') ledgerId: string) {
    return this.ledgerService.getDetail(user.id, ledgerId);
  }

  @Patch(':ledgerId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: UpdateLedgerDto,
  ) {
    const input: UpdateLedgerInput = {
      name: dto.name,
      defaultCurrency: dto.defaultCurrency,
      timezone: dto.timezone,
      icon: dto.icon,
      color: dto.color,
      updatedAt: new Date(dto.updatedAt),
    };
    return this.ledgerService.update(user.id, ledgerId, input);
  }
}
