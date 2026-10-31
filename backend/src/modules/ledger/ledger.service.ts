import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getDefaultCategoryData } from '../category/category.constants';
import type {
  CreateLedgerInput,
  LedgerQuery,
  LedgerSummary,
  UpdateLedgerInput,
} from './ledger.types';

const ledgerSelect = {
  id: true,
  name: true,
  type: true,
  defaultCurrency: true,
  icon: true,
  color: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

type LedgerRecord = Prisma.LedgerGetPayload<{ select: typeof ledgerSelect }>;
type TransactionClient = Prisma.TransactionClient;

function toLedgerSummary(
  ledger: LedgerRecord,
  memberRole: LedgerSummary['memberRole'],
  joinedAt: Date,
): LedgerSummary {
  return { ...ledger, memberRole, joinedAt };
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: LedgerQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const where: Prisma.LedgerMemberWhereInput = {
      userId,
      status: 'ACTIVE',
      ...(query.includeArchived ? {} : { ledger: { isArchived: false } }),
    };
    const [memberships, total] = await Promise.all([
      this.prisma.ledgerMember.findMany({
        where,
        orderBy: { joinedAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { role: true, joinedAt: true, ledger: { select: ledgerSelect } },
      }),
      this.prisma.ledgerMember.count({ where }),
    ]);

    return {
      items: memberships.map(({ ledger, role, joinedAt }) =>
        toLedgerSummary(ledger, role, joinedAt),
      ),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async create(userId: string, input: CreateLedgerInput): Promise<LedgerSummary> {
    const name = input.name.trim();
    if (!name) throw this.invalidNameException();

    return this.prisma.$transaction(async (transaction) => {
      const ledger = await transaction.ledger.create({
        data: {
          name,
          type: input.type,
          defaultCurrency: input.defaultCurrency ?? 'CNY',
          ...(input.icon === undefined ? {} : { icon: input.icon }),
          ...(input.color === undefined ? {} : { color: input.color }),
          creatorId: userId,
        },
        select: ledgerSelect,
      });
      const membership = await transaction.ledgerMember.create({
        data: { ledgerId: ledger.id, userId, role: 'OWNER', status: 'ACTIVE' },
        select: { role: true, joinedAt: true },
      });
      await transaction.category.createMany({ data: getDefaultCategoryData(ledger.id) });
      return toLedgerSummary(ledger, membership.role, membership.joinedAt);
    });
  }

  async getDetail(userId: string, ledgerId: string): Promise<LedgerSummary> {
    const membership = await this.getMembership(userId, ledgerId);
    if (!membership || membership.status !== 'ACTIVE') throw this.notFoundException();
    return toLedgerSummary(membership.ledger, membership.role, membership.joinedAt);
  }

  async update(
    userId: string,
    ledgerId: string,
    input: UpdateLedgerInput,
  ): Promise<LedgerSummary> {
    const membership = await this.getMembership(userId, ledgerId);
    if (!membership || membership.status !== 'ACTIVE') throw this.notFoundException();
    if (membership.role !== 'OWNER') throw this.forbiddenException();

    const ledger = await this.prisma.ledger.findUnique({
      where: { id: ledgerId },
      select: ledgerSelect,
    });
    if (!ledger) throw this.notFoundException();
    if (ledger.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw this.conflictException();
    }

    const data: Prisma.LedgerUpdateManyMutationInput = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
    };
    if (input.name !== undefined && !input.name.trim()) throw this.invalidNameException();

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.ledger.updateMany({
        where: { id: ledgerId, updatedAt: input.updatedAt },
        data,
      });
      if (updated.count !== 1) throw this.conflictException();

      const latest = await transaction.ledger.findUnique({
        where: { id: ledgerId },
        select: ledgerSelect,
      });
      if (!latest) throw this.notFoundException();
      return toLedgerSummary(latest, membership.role, membership.joinedAt);
    });
  }

  async getMembership(userId: string, ledgerId: string, transaction?: PrismaClient | TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: {
        role: true,
        status: true,
        joinedAt: true,
        ledger: { select: ledgerSelect },
      },
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40401, message: '账本资源不存在', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40301, message: '账本成员权限不足', data: null });
  }

  private conflictException(): ConflictException {
    return new ConflictException({ code: 40902, message: '账本版本已变化，请刷新后重试', data: null });
  }

  private invalidNameException(): BadRequestException {
    return new BadRequestException({ code: 40001, message: '账本名称不能为空', data: null });
  }
}
