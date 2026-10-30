import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { QueryAccountsDto } from './dto/query-accounts.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountService } from './account.service';
import type { AccountQuery, CreateAccountInput, UpdateAccountInput } from './account.types';

@Controller('ledgers/:ledgerId/accounts')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryAccountsDto,
  ) {
    return this.accountService.list(user.id, ledgerId, query as AccountQuery);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: CreateAccountDto,
  ) {
    const input: CreateAccountInput = {
      name: dto.name,
      type: dto.type,
      visibility: dto.visibility,
      initialBalanceCents: dto.initialBalanceCents,
      includeInAssets: dto.includeInAssets,
      icon: dto.icon,
      color: dto.color,
    };
    return this.accountService.create(user.id, ledgerId, input);
  }

  @Patch(':accountId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const input: UpdateAccountInput = {
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      includeInAssets: dto.includeInAssets,
      isActive: dto.isActive,
    };
    return this.accountService.update(user.id, ledgerId, accountId, input);
  }
}
