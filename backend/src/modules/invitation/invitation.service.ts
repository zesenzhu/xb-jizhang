import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmail } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AcceptedInvitationResult,
  CreateInvitationInput,
  InvitationSummary,
} from './invitation.types';

const INVITATION_TTL_SECONDS = 72 * 60 * 60;
const invitationSelect = {
  id: true,
  ledgerId: true,
  targetEmail: true,
  role: true,
  status: true,
  expiresAt: true,
} as const;
const ledgerSelect = {
  id: true,
  name: true,
  type: true,
  defaultCurrency: true,
  icon: true,
  color: true,
  isArchived: true,
} as const;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    ledgerId: string,
    input: CreateInvitationInput,
  ): Promise<InvitationSummary> {
    await this.requireOwner(userId, ledgerId);
    const targetEmail = normalizeEmail(input.targetEmail);
    if (!targetEmail) throw this.badRequestException('邀请邮箱不能为空');

    const targetUser = await this.prisma.user.findUnique({
      where: { email: targetEmail },
      select: { id: true },
    });
    if (targetUser) {
      const member = await this.prisma.ledgerMember.findUnique({
        where: { ledgerId_userId: { ledgerId, userId: targetUser.id } },
        select: { status: true },
      });
      if (member?.status === 'ACTIVE') throw this.duplicateException('该用户已经是账本成员');
    }

    const existing = await this.prisma.ledgerInvitation.findFirst({
      where: { ledgerId, targetEmail, status: 'PENDING' },
      select: { id: true, expiresAt: true },
    });
    const now = new Date();
    if (existing && existing.expiresAt > now) {
      throw this.duplicateException('该邮箱已有待处理邀请');
    }
    if (existing) {
      await this.prisma.ledgerInvitation.update({
        where: { id: existing.id },
        data: { status: 'EXPIRED' },
      });
    }

    const inviteToken = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.ledgerInvitation.create({
      data: {
        ledgerId,
        inviterId: userId,
        targetEmail,
        role: input.role,
        status: 'PENDING',
        tokenHash: hashToken(inviteToken),
        expiresAt: new Date(now.getTime() + INVITATION_TTL_SECONDS * 1000),
      },
      select: invitationSelect,
    });
    return { ...invitation, inviteToken };
  }

  async listForUser(userId: string): Promise<InvitationSummary[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const targetEmail = normalizeEmail(user?.email);
    if (!targetEmail) return [];

    return this.prisma.ledgerInvitation.findMany({
      where: { targetEmail, status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      select: { ...invitationSelect, ledger: { select: ledgerSelect } },
    });
  }

  async accept(userId: string, token: string): Promise<AcceptedInvitationResult> {
    const targetEmail = await this.requireUserEmail(userId);
    const invitation = await this.prisma.ledgerInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { ...invitationSelect, ledger: { select: ledgerSelect } },
    });
    if (!invitation || invitation.targetEmail !== targetEmail) throw this.notFoundException();
    if (invitation.status !== 'PENDING') throw this.conflictException('邀请已经处理');
    if (invitation.expiresAt <= new Date()) {
      await this.prisma.ledgerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw this.conflictException('邀请已过期');
    }

    return this.prisma.$transaction(async (transaction) => {
      const existingMember = await transaction.ledgerMember.findUnique({
        where: { ledgerId_userId: { ledgerId: invitation.ledgerId, userId } },
        select: { id: true, status: true },
      });
      if (existingMember?.status === 'ACTIVE') {
        throw this.duplicateException('该用户已经是账本成员');
      }

      if (existingMember) {
        const restored = await transaction.ledgerMember.updateMany({
          where: {
            id: existingMember.id,
            status: { in: ['LEFT', 'REMOVED'] },
          },
          data: { status: 'ACTIVE', role: invitation.role },
        });
        if (restored.count !== 1) throw this.conflictException();
      } else {
        await transaction.ledgerMember.create({
          data: {
            ledgerId: invitation.ledgerId,
            userId,
            role: invitation.role,
            status: 'ACTIVE',
          },
        });
      }

      const consumed = await transaction.ledgerInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (consumed.count !== 1) throw this.conflictException('邀请已经处理');

      const member = await transaction.ledgerMember.findUnique({
        where: { ledgerId_userId: { ledgerId: invitation.ledgerId, userId } },
        select: { role: true, joinedAt: true },
      });
      if (!member || (member.role !== 'EDITOR' && member.role !== 'VIEWER')) {
        throw this.conflictException();
      }
      return {
        id: invitation.id,
        ledgerId: invitation.ledgerId,
        memberRole: member.role,
        joinedAt: member.joinedAt,
        ledger: invitation.ledger,
      };
    });
  }

  async decline(userId: string, token: string): Promise<null> {
    const targetEmail = await this.requireUserEmail(userId);
    const invitation = await this.prisma.ledgerInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, targetEmail: true, status: true, expiresAt: true },
    });
    if (!invitation || invitation.targetEmail !== targetEmail) throw this.notFoundException();
    if (invitation.status === 'DECLINED') return null;
    if (invitation.status !== 'PENDING') throw this.conflictException('邀请已经处理');
    if (invitation.expiresAt <= new Date()) {
      await this.prisma.ledgerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw this.conflictException('邀请已过期');
    }
    const updated = await this.prisma.ledgerInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
    if (updated.count !== 1) throw this.conflictException('邀请已经处理');
    return null;
  }

  async revoke(userId: string, ledgerId: string, invitationId: string): Promise<null> {
    await this.requireOwner(userId, ledgerId);
    const invitation = await this.prisma.ledgerInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, ledgerId: true, status: true },
    });
    if (!invitation || invitation.ledgerId !== ledgerId) throw this.notFoundException();
    if (invitation.status !== 'PENDING') throw this.conflictException('邀请已经处理');
    const updated = await this.prisma.ledgerInvitation.updateMany({
      where: { id: invitationId, ledgerId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    if (updated.count !== 1) throw this.conflictException('邀请状态已变化');
    return null;
  }

  private async requireOwner(userId: string, ledgerId: string): Promise<void> {
    const member = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (member.role !== 'OWNER') throw this.forbiddenException();
  }

  private async requireUserEmail(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const email = normalizeEmail(user?.email);
    if (!email) throw this.badRequestException('接受或拒绝邀请前必须先设置邮箱');
    return email;
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40401, message: '邀请不存在或不可用', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40301, message: '账本成员权限不足', data: null });
  }

  private badRequestException(message: string): BadRequestException {
    return new BadRequestException({ code: 40001, message, data: null });
  }

  private conflictException(message = '邀请状态已变化，请刷新后重试'): ConflictException {
    return new ConflictException({ code: 40902, message, data: null });
  }

  private duplicateException(message: string): ConflictException {
    return new ConflictException({ code: 40901, message, data: null });
  }
}
