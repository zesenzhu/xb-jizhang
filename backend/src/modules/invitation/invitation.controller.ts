import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationTokenDto } from './dto/invitation-token.dto';
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

  @Get('invitations')
  list(@CurrentUser() user: AuthUser) {
    return this.invitationService.listForUser(user.id);
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
