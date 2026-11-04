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
import { isLedgerTimezone } from './ledger-timezone.validator';
import type {
  CopyLedgerInput,
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
  timezone: true,
  icon: true,
  color: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: { where: { status: 'ACTIVE' as const } } } },
} as const;

type LedgerRecord = Prisma.LedgerGetPayload<{ select: typeof ledgerSelect }>;
type TransactionClient = Prisma.TransactionClient;

function toLedgerSummary(
  ledger: LedgerRecord,
  memberRole: LedgerSummary['memberRole'],
  joinedAt: Date,
  preference?: { currentLedgerId: string | null; defaultLedgerId: string | null } | null,
): LedgerSummary {
  const { _count, ...fields } = ledger;
  return {
    ...fields,
    memberRole,
    joinedAt,
    memberCount: _count.members,
    isCurrent: preference?.currentLedgerId === ledger.id,
    isDefault: preference?.defaultLedgerId === ledger.id,
  };
}

function validateTimezone(timezone: string | undefined): void {
  if (timezone === undefined) return;
  if (!isLedgerTimezone(timezone)) {
    throw new BadRequestException({ code: 40001, message: '账本时区无效', data: null });
  }
}

function validateCurrency(currency: string | undefined): void {
  if (currency !== undefined && !Intl.supportedValuesOf('currency').includes(currency)) {
    throw new BadRequestException({ code: 40001, message: '账本币种无效', data: null });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
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
    };
    const [memberships, total, preference] = await Promise.all([
      this.prisma.ledgerMember.findMany({
        where,
        orderBy: { joinedAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { role: true, joinedAt: true, ledger: { select: ledgerSelect } },
      }),
      this.prisma.ledgerMember.count({ where }),
      this.prisma.userLedgerPreference.findUnique({
        where: { userId },
        select: { currentLedgerId: true, defaultLedgerId: true },
      }),
    ]);

    return {
      items: memberships.map(({ ledger, role, joinedAt }) =>
        toLedgerSummary(ledger, role, joinedAt, preference),
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
    validateTimezone(input.timezone);
    validateCurrency(input.defaultCurrency);

    return this.prisma.$transaction(async (transaction) => {
      const ledger = await transaction.ledger.create({
        data: {
          name,
          type: input.type,
          defaultCurrency: input.defaultCurrency ?? 'CNY',
          timezone: input.timezone ?? 'Asia/Shanghai',
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
      return { ...toLedgerSummary(ledger, membership.role, membership.joinedAt), memberCount: 1 };
    });
  }

  async copy(userId: string, sourceLedgerId: string, input: CopyLedgerInput): Promise<LedgerSummary> {
    const name = input.name.trim();
    if (!name) throw this.invalidNameException();
    validateTimezone(input.timezone);
    validateCurrency(input.defaultCurrency);

    const requestWhere = { userId_clientRequestId: { userId, clientRequestId: input.clientRequestId } };
    const readExisting = async (): Promise<LedgerSummary | null> => {
      const request = await this.prisma.ledgerCopyRequest.findUnique({
        where: requestWhere,
        select: { sourceLedgerId: true, targetLedgerId: true },
      });
      if (!request) return null;
      if ((request.sourceLedgerId && request.sourceLedgerId !== sourceLedgerId) || !request.targetLedgerId) {
        throw this.copyConflictException();
      }
      try {
        return await this.getDetail(userId, request.targetLedgerId);
      } catch (error) {
        if (error instanceof NotFoundException) throw this.copyConflictException();
        throw error;
      }
    };

    const existing = await readExisting();
    if (existing) return existing;
    const sourceMembership = await this.getMembership(userId, sourceLedgerId);
    if (!sourceMembership || sourceMembership.status !== 'ACTIVE') throw this.notFoundException();
    if (sourceMembership.role !== 'OWNER') throw this.forbiddenException();

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const membership = await this.getMembership(userId, sourceLedgerId, transaction);
        if (!membership || membership.status !== 'ACTIVE') throw this.notFoundException();
        if (membership.role !== 'OWNER') throw this.forbiddenException();

        await transaction.ledgerCopyRequest.create({
          data: { userId, clientRequestId: input.clientRequestId, sourceLedgerId },
        });
        const source = membership.ledger;
        const ledger = await transaction.ledger.create({
          data: {
            name,
            type: input.type,
            defaultCurrency: input.defaultCurrency ?? source.defaultCurrency,
            timezone: input.timezone ?? source.timezone,
            icon: input.icon === undefined ? source.icon : input.icon,
            color: input.color === undefined ? source.color : input.color,
            creatorId: userId,
          },
          select: ledgerSelect,
        });
        const owner = await transaction.ledgerMember.create({
          data: { ledgerId: ledger.id, userId, role: 'OWNER', status: 'ACTIVE' },
          select: { role: true, joinedAt: true },
        });

        const categories = await transaction.category.findMany({
          where: { ledgerId: sourceLedgerId },
          select: { id: true, type: true, name: true, parentId: true, icon: true, color: true,
            sortOrder: true, isSystem: true, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        const ids = new Map<string, string>();
        let pending = categories;
        while (pending.length > 0) {
          const next = pending.filter((category) => !category.parentId || ids.has(category.parentId));
          if (next.length === 0) throw this.copyConflictException();
          for (const category of next) {
            const created = await transaction.category.create({
              data: {
                ledgerId: ledger.id,
                type: category.type,
                name: category.name,
                parentId: category.parentId ? ids.get(category.parentId)! : null,
                icon: category.icon,
                color: category.color,
                sortOrder: category.sortOrder,
                isSystem: category.isSystem,
                isActive: category.isActive,
              },
              select: { id: true },
            });
            ids.set(category.id, created.id);
          }
          const copied = new Set(next.map((category) => category.id));
          pending = pending.filter((category) => !copied.has(category.id));
        }

        await transaction.ledgerCopyRequest.update({
          where: requestWhere,
          data: { targetLedgerId: ledger.id },
        });
        return { ...toLedgerSummary(ledger, owner.role, owner.joinedAt), memberCount: 1 };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrent = await readExisting();
        if (concurrent) return concurrent;
        throw this.copyConflictException();
      }
      throw error;
    }
  }

  async getDetail(userId: string, ledgerId: string): Promise<LedgerSummary> {
    const membership = await this.getMembership(userId, ledgerId);
    if (!membership || membership.status !== 'ACTIVE') throw this.notFoundException();
    const preference = await this.prisma.userLedgerPreference.findUnique({
      where: { userId }, select: { currentLedgerId: true, defaultLedgerId: true },
    });
    return toLedgerSummary(membership.ledger, membership.role, membership.joinedAt, preference);
  }

  async update(
    userId: string,
    ledgerId: string,
    input: UpdateLedgerInput,
  ): Promise<LedgerSummary> {
    validateTimezone(input.timezone);
    validateCurrency(input.defaultCurrency);
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
      ...(input.defaultCurrency === undefined ? {} : { defaultCurrency: input.defaultCurrency }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      ...(input.color === undefined ? {} : { color: input.color }),
    };
    if (input.name !== undefined && !input.name.trim()) throw this.invalidNameException();

    return this.prisma.$transaction(async (transaction) => {
      if (input.defaultCurrency !== undefined && input.defaultCurrency !== ledger.defaultCurrency) {
        await transaction.$queryRaw(Prisma.sql`SELECT id FROM "ledger" WHERE id = ${ledgerId} FOR UPDATE`);
        const count = await transaction.transaction.count({ where: { ledgerId } });
        if (count > 0) throw this.currencyConflictException();
      }
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
      const preference = await transaction.userLedgerPreference.findUnique({
        where: { userId }, select: { currentLedgerId: true, defaultLedgerId: true },
      });
      return toLedgerSummary(latest, membership.role, membership.joinedAt, preference);
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

  private currencyConflictException(): ConflictException {
    return new ConflictException({ code: 40902, message: '账本已有账单，不能修改默认币种', data: null });
  }

  private copyConflictException(): ConflictException {
    return new ConflictException({ code: 40902, message: '复制请求已失效或发生冲突', data: null });
  }

  private invalidNameException(): BadRequestException {
    return new BadRequestException({ code: 40001, message: '账本名称不能为空', data: null });
  }
}
