import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationTokenDto } from './dto/invitation-token.dto';
import { InvitationTokenQueryDto } from './dto/invitation-token-query.dto';
import { InvitationService } from './invitation.service';
import type { CreateInvitationInput } from './invitation.types';

@Controller()
@UseGuards(AuthGuard)
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('ledgers/:ledgerId/invitations')
  create(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    const input: CreateInvitationInput = { targetEmail: dto.targetEmail, role: dto.role };
    return this.invitationService.create(user.id, ledgerId, input);
  }

  @Get('ledgers/:ledgerId/invitations')
  listForLedger(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
  ) {
    return this.invitationService.listForLedger(user.id, ledgerId);
  }

  @Get('invitations')
  list(@CurrentUser() user: AuthUser) {
    return this.invitationService.listForUser(user.id);
  }

  @Get('invitations/token')
  detail(@CurrentUser() user: AuthUser, @Query() query: InvitationTokenQueryDto) {
    return this.invitationService.getByToken(user.id, query.token);
  }

  @Post('invitations/:invitationId/accept')
  acceptById(
    @CurrentUser() user: AuthUser,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationService.acceptById(user.id, invitationId);
  }

  @Post('invitations/:invitationId/decline')
  declineById(
    @CurrentUser() user: AuthUser,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationService.declineById(user.id, invitationId);
  }

  @Post('invitations/accept')
  accept(@CurrentUser() user: AuthUser, @Body() dto: InvitationTokenDto) {
    return this.invitationService.accept(user.id, dto.token);
  }

  @Post('invitations/decline')
  decline(@CurrentUser() user: AuthUser, @Body() dto: InvitationTokenDto) {
    return this.invitationService.decline(user.id, dto.token);
  }

  @Delete('ledgers/:ledgerId/invitations/:invitationId')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationService.revoke(user.id, ledgerId, invitationId);
  }
}

/** 登录前预览不需要认证，独立控制器避免类级 AuthGuard 误拦截。 */
@Controller('invitations')
export class InvitationPublicController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get('preview')
  preview(@Query() query: InvitationTokenQueryDto) {
    return this.invitationService.previewByToken(query.token);
  }
}
