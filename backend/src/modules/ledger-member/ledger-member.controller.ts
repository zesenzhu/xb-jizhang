import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { QueryMembersDto } from './dto/query-members.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { LedgerMemberService } from './ledger-member.service';

@Controller('ledgers/:ledgerId')
@UseGuards(AuthGuard)
export class LedgerMemberController {
  constructor(private readonly memberService: LedgerMemberService) {}

  @Get('members')
  list(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryMembersDto,
  ) {
    return this.memberService.list(user.id, ledgerId, query.page, query.pageSize);
  }

  @Patch('members/:memberId/role')
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.memberService.updateRole(user.id, ledgerId, memberId, dto.role);
  }

  @Delete('members/:memberId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.memberService.remove(user.id, ledgerId, memberId);
  }

  @Post('members/leave')
  leave(@CurrentUser() user: AuthUser, @Param('ledgerId') ledgerId: string) {
    return this.memberService.leave(user.id, ledgerId);
  }

  @Post('ownership-transfer')
  transferOwnership(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.memberService.transferOwnership(user.id, ledgerId, dto.targetMemberId);
  }
}
