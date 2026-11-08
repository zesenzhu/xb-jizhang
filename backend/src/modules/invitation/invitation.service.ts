import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InvitationStatus, LedgerMemberRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmail } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AcceptedInvitationResult,
  CreateInvitationInput,
  InvitationBlockedReason,
  InvitationDetail,
  InvitationPreview,
  InvitationSummary,
} from './invitation.types';

const INVITATION_TTL_SECONDS = 72 * 60 * 60;
const invitationSelect = {
  id: true,
  ledgerId: true,
  targetEmail: true,
  role: true,
  status: true,
  createdAt: true,
  expiresAt: true,
} as const;
const ledgerSelect = {
  id: true,
  name: true,
  type: true,
  defaultCurrency: true,
  timezone: true,
  icon: true,
  color: true,
} as const;
const inviterSelect = {
  id: true,
  username: true,
  nickname: true,
  avatar: true,
} as const;
const invitationDetailSelect = {
  ...invitationSelect,
  ledger: { select: ledgerSelect },
  inviter: { select: inviterSelect },
} as const;

type InvitationDetailRecord = Prisma.LedgerInvitationGetPayload<{
  select: typeof invitationDetailSelect;
}>;
type MemberRecord = { role: LedgerMemberRole; joinedAt: Date };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local?.slice(0, 1) ?? ''}***@${domain}`;
}

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    ledgerId: string,
    input: CreateInvitationInput,
  ): Promise<InvitationSummary> {
    const owner = await this.requireOwner(userId, ledgerId);
    this.requireSharedLedger(owner.ledger?.type);
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
    try {
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
    } catch (error) {
      // 部分唯一索引是最终并发保护；两个 Owner 同时邀请时统一返回业务冲突。
      if (isUniqueConstraintError(error)) {
        throw this.duplicateException('该邮箱已有待处理邀请');
      }
      throw error;
    }
  }

  async listForLedger(userId: string, ledgerId: string): Promise<InvitationSummary[]> {
    const owner = await this.requireOwner(userId, ledgerId);
    this.requireSharedLedger(owner.ledger?.type);

    const now = new Date();
    await this.prisma.ledgerInvitation.updateMany({
      where: { ledgerId, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });

    return this.prisma.ledgerInvitation.findMany({
      where: { ledgerId, status: 'PENDING' },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      select: invitationSelect,
    });
  }

  async listForUser(userId: string): Promise<InvitationSummary[]> {
    const targetEmail = await this.requireOptionalUserEmail(userId);
    if (!targetEmail) return [];

    const now = new Date();
    await this.prisma.ledgerInvitation.updateMany({
      where: { targetEmail, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });

    return this.prisma.ledgerInvitation.findMany({
      where: { targetEmail, status: 'PENDING', expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
      select: invitationDetailSelect,
    });
  }

  /** 登录前预览：只返回邀请说明，不返回账本 ID、成员或账单内容。 */
  async previewByToken(token: string): Promise<InvitationPreview> {
    const invitation = await this.findByToken(token);
    if (!invitation) throw this.notFoundInvitationException();
    const status = await this.expireIfNeeded(invitation);
    return {
      ledgerName: invitation.ledger.name,
      inviterName: this.inviterName(invitation.inviter),
      role: invitation.role,
      status,
      expiresAt: invitation.expiresAt,
      canRespondAfterLogin: status === 'PENDING',
    };
  }

  /** 登录后详情：返回邮箱匹配状态和可执行动作，不消费邀请。 */
  async getByToken(userId: string, token: string): Promise<InvitationDetail> {
    const invitation = await this.findByToken(token);
    if (!invitation) throw this.notFoundInvitationException();
    return this.toDetail(userId, invitation);
  }

  async accept(userId: string, token: string): Promise<AcceptedInvitationResult> {
    const invitation = await this.findByToken(token);
    if (!invitation) throw this.notFoundInvitationException();
    return this.acceptResolved(userId, invitation);
  }

  async acceptById(userId: string, invitationId: string): Promise<AcceptedInvitationResult> {
    const invitation = await this.findById(invitationId);
    if (!invitation) throw this.notFoundInvitationException();
    return this.acceptResolved(userId, invitation);
  }

  async decline(userId: string, token: string): Promise<null> {
    const invitation = await this.findByToken(token);
    if (!invitation) throw this.notFoundInvitationException();
    return this.declineResolved(userId, invitation);
  }

  async declineById(userId: string, invitationId: string): Promise<null> {
    const invitation = await this.findById(invitationId);
    if (!invitation) throw this.notFoundInvitationException();
    return this.declineResolved(userId, invitation);
  }

  async revoke(userId: string, ledgerId: string, invitationId: string): Promise<null> {
    const owner = await this.requireOwner(userId, ledgerId);
    this.requireSharedLedger(owner.ledger?.type);
    const invitation = await this.prisma.ledgerInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, ledgerId: true, status: true },
    });
    if (!invitation || invitation.ledgerId !== ledgerId) throw this.notFoundInvitationException();
    if (invitation.status !== 'PENDING') throw this.stateConflictException(invitation.status);
    const updated = await this.prisma.ledgerInvitation.updateMany({
      where: { id: invitationId, ledgerId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    if (updated.count !== 1) throw this.stateConflictException('REVOKED');
    return null;
  }

  private async acceptResolved(
    userId: string,
    invitation: InvitationDetailRecord,
  ): Promise<AcceptedInvitationResult> {
    const targetEmail = await this.requireUserEmail(userId);
    this.requireEmailMatch(targetEmail, invitation.targetEmail);

    const status = await this.expireIfNeeded(invitation);
    if (status === 'ACCEPTED') {
      const member = await this.findMember(invitation.ledgerId, userId);
      if (member?.status === 'ACTIVE') {
        return this.acceptedResult(invitation, member, true);
      }
      throw this.stateConflictException(status);
    }
    if (status !== 'PENDING') throw this.stateConflictException(status);

    return this.prisma.$transaction(async (transaction) => {
      // 恢复旧成员是 UPDATE，不会获取外键锁；先锁账本以与安全删除按相同顺序互斥。
      const ledgers = await transaction.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM "ledger" WHERE id = ${invitation.ledgerId} FOR KEY SHARE`,
      );
      if (ledgers.length === 0) throw this.notFoundInvitationException();

      const existingMember = await transaction.ledgerMember.findUnique({
        where: { ledgerId_userId: { ledgerId: invitation.ledgerId, userId } },
        select: { id: true, role: true, status: true, joinedAt: true },
      });

      // 已是活跃成员时消费邀请但不改角色；重复接受保持幂等。
      if (existingMember?.status === 'ACTIVE') {
        await this.consumeInvitation(transaction, invitation.id);
        return this.acceptedResult(
          invitation,
          { role: existingMember.role, joinedAt: existingMember.joinedAt },
          true,
        );
      }

      if (existingMember) {
        const restored = await transaction.ledgerMember.updateMany({
          where: {
            id: existingMember.id,
            status: { in: ['LEFT', 'REMOVED'] },
          },
          data: { status: 'ACTIVE', role: invitation.role },
        });
        if (restored.count !== 1) throw this.stateConflictException('ACCEPTED');
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

      await this.consumeInvitation(transaction, invitation.id);

      const member = await transaction.ledgerMember.findUnique({
        where: { ledgerId_userId: { ledgerId: invitation.ledgerId, userId } },
        select: { role: true, joinedAt: true },
      });
      if (!member) throw this.stateConflictException('ACCEPTED');
      return this.acceptedResult(invitation, member, false);
    });
  }

  private async declineResolved(
    userId: string,
    invitation: InvitationDetailRecord,
  ): Promise<null> {
    const targetEmail = await this.requireUserEmail(userId);
    this.requireEmailMatch(targetEmail, invitation.targetEmail);

    const status = await this.expireIfNeeded(invitation);
    if (status === 'DECLINED') return null;
    if (status !== 'PENDING') throw this.stateConflictException(status);

    const updated = await this.prisma.ledgerInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
    if (updated.count !== 1) throw this.stateConflictException('DECLINED');
    return null;
  }

  private async toDetail(
    userId: string,
    invitation: InvitationDetailRecord,
  ): Promise<InvitationDetail> {
    const userEmail = await this.requireOptionalUserEmail(userId);
    const status = await this.expireIfNeeded(invitation);
    const hasEmail = Boolean(userEmail);
    const emailMatched = Boolean(userEmail && userEmail === invitation.targetEmail);
    const member = await this.findMember(invitation.ledgerId, userId);

    let blockedReason: InvitationBlockedReason | null = null;
    if (status !== 'PENDING') {
      blockedReason = status === 'ACCEPTED' && member?.status === 'ACTIVE'
        ? 'ALREADY_MEMBER'
        : status;
    } else if (!hasEmail) {
      blockedReason = 'EMAIL_REQUIRED';
    } else if (!emailMatched) {
      blockedReason = 'EMAIL_MISMATCH';
    } else if (member?.status === 'ACTIVE') {
      blockedReason = 'ALREADY_MEMBER';
    }

    return {
      ...invitation,
      targetEmailMasked: maskEmail(invitation.targetEmail),
      hasEmail,
      emailMatched,
      canAccept: blockedReason === null,
      canDecline: status === 'PENDING' && emailMatched,
      blockedReason,
      ...(member?.status === 'ACTIVE' ? { memberRole: member.role } : {}),
    };
  }

  private async expireIfNeeded(
    invitation: InvitationDetailRecord,
  ): Promise<InvitationStatus> {
    if (invitation.status !== 'PENDING' || invitation.expiresAt > new Date()) {
      return invitation.status;
    }
    await this.prisma.ledgerInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return 'EXPIRED';
  }

  private async consumeInvitation(
    transaction: Prisma.TransactionClient,
    invitationId: string,
  ): Promise<void> {
    const consumed = await transaction.ledgerInvitation.updateMany({
      where: { id: invitationId, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (consumed.count !== 1) throw this.stateConflictException('ACCEPTED');
  }

  private acceptedResult(
    invitation: InvitationDetailRecord,
    member: MemberRecord,
    alreadyMember: boolean,
  ): AcceptedInvitationResult {
    return {
      id: invitation.id,
      ledgerId: invitation.ledgerId,
      memberRole: member.role,
      joinedAt: member.joinedAt,
      ledger: invitation.ledger,
      alreadyMember,
    };
  }

  private async findByToken(token: string): Promise<InvitationDetailRecord | null> {
    return this.prisma.ledgerInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: invitationDetailSelect,
    });
  }

  private async findById(invitationId: string): Promise<InvitationDetailRecord | null> {
    return this.prisma.ledgerInvitation.findUnique({
      where: { id: invitationId },
      select: invitationDetailSelect,
    });
  }

  private async findMember(ledgerId: string, userId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true, joinedAt: true },
    });
  }

  private async requireOptionalUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return normalizeEmail(user?.email) || null;
  }

  private async requireUserEmail(userId: string): Promise<string> {
    const email = await this.requireOptionalUserEmail(userId);
    if (!email) throw this.emailRequiredException();
    return email;
  }

  private requireEmailMatch(currentEmail: string, targetEmail: string): void {
    if (currentEmail !== targetEmail) {
      throw new ForbiddenException({
        code: 40331,
        message: '当前账号邮箱与邀请邮箱不一致',
        data: { action: 'CHANGE_EMAIL', targetEmailMasked: maskEmail(targetEmail) },
      });
    }
  }

  private inviterName(inviter: InvitationDetailRecord['inviter']): string {
    return inviter.nickname?.trim() || inviter.username;
  }

  private async requireOwner(userId: string, ledgerId: string) {
    const member = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true, ledger: { select: { type: true } } },
    });
    if (!member || member.status !== 'ACTIVE') throw this.notFoundInvitationException();
    if (member.role !== 'OWNER') throw this.forbiddenException();
    return member;
  }

  private requireSharedLedger(type: string | undefined): void {
    if (type === 'PERSONAL') {
      throw new ConflictException({
        code: 40903,
        message: '个人账本不能邀请成员',
        data: null,
      });
    }
  }

  private emailRequiredException(): BadRequestException {
    return new BadRequestException({
      code: 40031,
      message: '接受或拒绝邀请前必须先设置邮箱',
      data: { action: 'SET_EMAIL' },
    });
  }

  private notFoundInvitationException(): NotFoundException {
    return new NotFoundException({ code: 40431, message: '邀请不存在或不可用', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40301, message: '账本成员权限不足', data: null });
  }

  private badRequestException(message: string): BadRequestException {
    return new BadRequestException({ code: 40001, message, data: null });
  }

  private stateConflictException(status: InvitationStatus | 'REVOKED'): ConflictException {
    return new ConflictException({
      code: 40931,
      message: status === 'EXPIRED' ? '邀请已过期' : '邀请状态已变化，请刷新后重试',
      data: { status },
    });
  }

  private duplicateException(message: string): ConflictException {
    return new ConflictException({ code: 40901, message, data: null });
  }
}
