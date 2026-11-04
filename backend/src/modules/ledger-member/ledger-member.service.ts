import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LedgerMemberSummary, OwnershipTransferResult } from './ledger-member.types';

const memberSelect = {
  id: true,
  ledgerId: true,
  userId: true,
  role: true,
  status: true,
  joinedAt: true,
  user: { select: { id: true, username: true, nickname: true, avatar: true } },
} as const;

type MemberRecord = Prisma.LedgerMemberGetPayload<{ select: typeof memberSelect }>;

function toMemberSummary(member: MemberRecord): LedgerMemberSummary {
  return member;
}

@Injectable()
export class LedgerMemberService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, ledgerId: string, page = 1, pageSize = 20) {
    const actor = await this.getMembership(userId, ledgerId);
    if (!actor || actor.status !== 'ACTIVE') throw this.notFoundException();

    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.min(100, Math.max(1, pageSize));
    const where = { ledgerId, status: 'ACTIVE' as const };
    const [members, total] = await Promise.all([
      this.prisma.ledgerMember.findMany({
        where,
        orderBy: { joinedAt: 'asc' },
        skip: (normalizedPage - 1) * normalizedPageSize,
        take: normalizedPageSize,
        select: memberSelect,
      }),
      this.prisma.ledgerMember.count({ where }),
    ]);
    return {
      items: members.map(toMemberSummary),
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      hasNextPage: normalizedPage * normalizedPageSize < total,
    };
  }

  async updateRole(
    userId: string,
    ledgerId: string,
    memberId: string,
    role: 'OWNER' | 'EDITOR' | 'VIEWER',
  ): Promise<LedgerMemberSummary> {
    const actor = await this.requireOwner(userId, ledgerId);
    const target = await this.getMemberById(ledgerId, memberId);
    if (!target || target.status !== 'ACTIVE') throw this.notFoundException();

    if (target.id === actor.id && role !== 'OWNER') {
      await this.ensureAnotherOwner(ledgerId, actor.id);
    }
    if (target.role === 'OWNER' && role !== 'OWNER') {
      await this.ensureAnotherOwner(ledgerId, target.id);
    }
    if (target.role === role) return toMemberSummary(target);

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.ledgerMember.updateMany({
        where: { id: memberId, ledgerId, status: 'ACTIVE' },
        data: { role },
      });
      if (updated.count !== 1) throw this.conflictException();
      const latest = await transaction.ledgerMember.findUnique({
        where: { id: memberId },
        select: memberSelect,
      });
      if (!latest || latest.status !== 'ACTIVE') throw this.conflictException();
      return toMemberSummary(latest);
    });
  }

  async remove(userId: string, ledgerId: string, memberId: string): Promise<null> {
    const actor = await this.requireOwner(userId, ledgerId);
    const target = await this.getMemberById(ledgerId, memberId);
    if (!target || target.status !== 'ACTIVE') throw this.notFoundException();
    if (target.id === actor.id) throw this.conflictException('不能移除自己，请使用退出接口');
    if (target.role === 'OWNER') await this.ensureAnotherOwner(ledgerId, target.id);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockUser(transaction, target.userId);
      const updated = await transaction.ledgerMember.updateMany({
        where: { id: memberId, ledgerId, status: 'ACTIVE' },
        data: { status: 'REMOVED' },
      });
      if (updated.count !== 1) throw this.conflictException();
      return null;
    });
  }

  async leave(userId: string, ledgerId: string): Promise<null> {
    const actor = await this.getMembership(userId, ledgerId);
    if (!actor || actor.status !== 'ACTIVE') throw this.notFoundException();
    if (actor.role === 'OWNER') await this.ensureAnotherOwner(ledgerId, actor.id);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockUser(transaction, userId);
      const updated = await transaction.ledgerMember.updateMany({
        where: { id: actor.id, ledgerId, userId, status: 'ACTIVE' },
        data: { status: 'LEFT' },
      });
      if (updated.count !== 1) throw this.conflictException();
      return null;
    });
  }

  async transferOwnership(
    userId: string,
    ledgerId: string,
    targetMemberId: string,
  ): Promise<OwnershipTransferResult> {
    const actor = await this.requireOwner(userId, ledgerId);
    const target = await this.getMemberById(ledgerId, targetMemberId);
    if (!target || target.status !== 'ACTIVE') throw this.notFoundException();
    if (target.id === actor.id || target.role === 'OWNER') {
      const currentOwner = await this.getMemberById(ledgerId, actor.id);
      if (!currentOwner) throw this.notFoundException();
      return { previousOwner: toMemberSummary(currentOwner), newOwner: toMemberSummary(target) };
    }

    return this.prisma.$transaction(async (transaction) => {
      const previousOwner = await transaction.ledgerMember.updateMany({
        where: { id: actor.id, ledgerId, status: 'ACTIVE', role: 'OWNER' },
        data: { role: 'EDITOR' },
      });
      const newOwner = await transaction.ledgerMember.updateMany({
        where: { id: targetMemberId, ledgerId, status: 'ACTIVE' },
        data: { role: 'OWNER' },
      });
      if (previousOwner.count !== 1 || newOwner.count !== 1) {
        throw this.conflictException();
      }

      const members = await transaction.ledgerMember.findMany({
        where: { id: { in: [actor.id, targetMemberId] } },
        select: memberSelect,
      });
      const previous = members.find(({ id }) => id === actor.id);
      const next = members.find(({ id }) => id === targetMemberId);
      if (!previous || !next) throw this.conflictException();
      return { previousOwner: toMemberSummary(previous), newOwner: toMemberSummary(next) };
    });
  }

  private async lockUser(transaction: Prisma.TransactionClient, userId: string): Promise<void> {
    // 与删除按 user -> membership 同序串行化；退出/移除本身允许用户不再拥有账本。
    await transaction.$queryRaw(Prisma.sql`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`);
  }

  private async requireOwner(userId: string, ledgerId: string) {
    const actor = await this.getMembership(userId, ledgerId);
    if (!actor || actor.status !== 'ACTIVE') throw this.notFoundException();
    if (actor.role !== 'OWNER') throw this.forbiddenException();
    return actor;
  }

  private async getMembership(userId: string, ledgerId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { id: true, ledgerId: true, userId: true, role: true, status: true },
    });
  }

  private async getMemberById(ledgerId: string, memberId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { id: memberId },
      select: memberSelect,
    }).then((member) => (member?.ledgerId === ledgerId ? member : null));
  }

  private async ensureAnotherOwner(ledgerId: string, memberId: string): Promise<void> {
    const ownerCount = await this.prisma.ledgerMember.count({
      where: { ledgerId, status: 'ACTIVE', role: 'OWNER', NOT: { id: memberId } },
    });
    if (ownerCount < 1) throw this.conflictException('账本至少需要保留一名 Owner');
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40401, message: '账本成员不存在', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40301, message: '账本成员权限不足', data: null });
  }

  private conflictException(message = '成员状态已变化，请刷新后重试'): ConflictException {
    return new ConflictException({ code: 40902, message, data: null });
  }
}
