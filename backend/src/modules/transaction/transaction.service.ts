import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateTransactionInput,
  TransactionQuery,
  TransactionSummary,
  UpdateTransactionInput,
} from './transaction.types';

const transactionSelect = {
  id: true,
  ledgerId: true,
  type: true,
  amountCents: true,
  occurredAt: true,
  title: true,
  note: true,
  categoryId: true,
  accountId: true,
  fromAccountId: true,
  toAccountId: true,
  transferGroupId: true,
  source: true,
  clientRequestId: true,
  createdById: true,
  updatedById: true,
  payerId: true,
  version: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, type: true, name: true, parentId: true } },
  account: { select: { id: true, name: true, visibility: true } },
  payer: { select: { id: true, nickname: true } },
} as const;

type TransactionRecord = Prisma.TransactionGetPayload<{ select: typeof transactionSelect }>;
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    ledgerId: string,
    input: CreateTransactionInput,
  ): Promise<TransactionSummary> {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (member.role === 'VIEWER') throw this.forbiddenException();
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw this.invalidInputException();
    }

    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw this.invalidInputException();

    const existing = await this.findByClientRequestId(ledgerId, input.clientRequestId);
    if (existing) return this.toSummary(existing);

    if (input.accountId) {
      const account = await this.findWritableAccount(userId, ledgerId, input.accountId);
      if (!account) throw this.notFoundException();
    }

    const category = await this.prisma.category.findFirst({
      where: { id: input.categoryId, ledgerId, type: input.type, isActive: true },
      select: { id: true, ledgerId: true, type: true, name: true, isActive: true },
    });
    if (!category || category.type !== input.type) throw this.notFoundException();

    if (input.payerId) {
      const payer = await this.getMembership(input.payerId, ledgerId);
      if (!payer || payer.status !== 'ACTIVE') throw this.notFoundException();
    }

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const createdTransaction = await transaction.transaction.create({
          data: {
            ledgerId,
            type: input.type,
            amountCents: input.amountCents,
            occurredAt,
            title: this.normalizeOptionalText(input.title),
            note: this.normalizeOptionalText(input.note),
            categoryId: input.categoryId,
            accountId: input.accountId ?? null,
            source: 'MANUAL',
            clientRequestId: input.clientRequestId,
            createdById: userId,
            updatedById: userId,
            payerId: input.payerId ?? null,
          },
          select: transactionSelect,
        });

        if (input.accountId) {
          const balanceChange =
            input.type === 'EXPENSE' ? { decrement: input.amountCents } : { increment: input.amountCents };
          const updatedAccount = await transaction.account.updateMany({
            where: { id: input.accountId, ledgerId, isActive: true },
            data: { currentBalanceCents: balanceChange },
          });
          if (updatedAccount.count !== 1) throw this.notFoundException();
        }

        await transaction.transactionAuditLog.create({
          data: {
            ledgerId,
            transactionId: createdTransaction.id,
            operatorId: userId,
            action: 'CREATE',
            afterData: this.toAuditData(createdTransaction),
          },
        });
        return createdTransaction;
      });

      return this.toSummary(await this.readDetailRecord(userId, ledgerId, created.id, created));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrent = await this.findByClientRequestId(ledgerId, input.clientRequestId);
        if (concurrent) return this.toSummary(concurrent);
        throw this.idempotencyConflictException();
      }
      throw error;
    }
  }

  async getDetail(userId: string, ledgerId: string, transactionId: string): Promise<TransactionSummary> {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    const record = await this.readDetailRecord(userId, ledgerId, transactionId);
    return this.toSummary(record);
  }

  /**
   * 编辑账单时以版本条件更新，并在同一事务中重算旧、新账单对账户余额的影响。
   */
  async update(
    userId: string,
    ledgerId: string,
    transactionId: string,
    input: UpdateTransactionInput,
  ): Promise<TransactionSummary> {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (member.role === 'VIEWER') throw this.forbiddenException();
    if (!Number.isInteger(input.version) || input.version <= 0) throw this.invalidInputException();

    const current = await this.prisma.transaction.findFirst({
      where: { id: transactionId, ledgerId },
      select: transactionSelect,
    });
    if (!current) throw this.notFoundException();
    if (current.type === 'TRANSFER') throw this.invalidInputException();
    if (current.deletedAt) throw this.conflictException();
    if (input.version !== current.version) throw this.conflictException();

    const nextType: Extract<TransactionType, 'EXPENSE' | 'INCOME'> =
      input.type ?? (current.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
    const nextAmount = input.amountCents ?? current.amountCents;
    const nextOccurredAt = input.occurredAt === undefined ? current.occurredAt : new Date(input.occurredAt);
    if (!['EXPENSE', 'INCOME'].includes(nextType) || !Number.isInteger(nextAmount) || nextAmount <= 0) {
      throw this.invalidInputException();
    }
    if (Number.isNaN(nextOccurredAt.getTime())) throw this.invalidInputException();

    const nextAccountId = input.accountId === undefined ? current.accountId : input.accountId;
    const nextCategoryId = input.categoryId ?? current.categoryId;
    if (!nextCategoryId) throw this.invalidInputException();
    if (nextAccountId) {
      const account = await this.findWritableAccount(userId, ledgerId, nextAccountId);
      if (!account) throw this.notFoundException();
    }
    const category = await this.prisma.category.findFirst({
      where: { id: nextCategoryId, ledgerId, type: nextType, isActive: true },
      select: { id: true, ledgerId: true, type: true, name: true, isActive: true },
    });
    if (!category) throw this.notFoundException();

    const nextPayerId = input.payerId === undefined ? current.payerId : input.payerId;
    if (nextPayerId) {
      const payer = await this.getMembership(nextPayerId, ledgerId);
      if (!payer || payer.status !== 'ACTIVE') throw this.notFoundException();
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      // 先恢复旧账单影响，再应用新账单影响，确保金额方向或账户切换时余额仍与未删除账单一致。
      await this.applyBalanceChange(transaction, ledgerId, current.accountId, current.type, current.amountCents, 'restore');
      if (nextAccountId) {
        await this.applyBalanceChange(transaction, ledgerId, nextAccountId, nextType, nextAmount, 'apply');
      }

      const result = await transaction.transaction.updateMany({
        where: { id: transactionId, ledgerId, version: input.version, deletedAt: null },
        data: {
          type: nextType,
          amountCents: nextAmount,
          occurredAt: nextOccurredAt,
          categoryId: nextCategoryId,
          accountId: nextAccountId,
          payerId: nextPayerId,
          title: input.title === undefined ? current.title : this.normalizeOptionalText(input.title),
          note: input.note === undefined ? current.note : this.normalizeOptionalText(input.note),
          updatedById: userId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw this.conflictException();

      await transaction.transactionAuditLog.create({
        data: {
          ledgerId,
          transactionId,
          operatorId: userId,
          action: 'UPDATE',
          beforeData: this.toAuditData(current),
          afterData: {
            ...this.toAuditData(current),
            type: nextType,
            amountCents: nextAmount,
            occurredAt: nextOccurredAt.toISOString(),
            categoryId: nextCategoryId,
            accountId: nextAccountId,
            payerId: nextPayerId,
            title: input.title === undefined ? current.title : this.normalizeOptionalText(input.title),
            note: input.note === undefined ? current.note : this.normalizeOptionalText(input.note),
            version: current.version + 1,
          },
        },
      });
      return transaction.transaction.findUnique({ where: { id: transactionId }, select: transactionSelect });
    });
    if (!updated) throw this.notFoundException();
    return this.toSummary(await this.readDetailRecord(userId, ledgerId, transactionId, updated));
  }

  /**
   * 软删除账单并恢复余额；删除权限在服务端按账本角色和创建人再次校验。
   */
  async remove(userId: string, ledgerId: string, transactionId: string, version: number): Promise<TransactionSummary> {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (!Number.isInteger(version) || version <= 0) throw this.invalidInputException();

    const current = await this.prisma.transaction.findFirst({
      where: { id: transactionId, ledgerId },
      select: transactionSelect,
    });
    if (!current) throw this.notFoundException();
    if (current.type === 'TRANSFER') throw this.invalidInputException();
    if (member.role === 'VIEWER' || (member.role === 'EDITOR' && current.createdById !== userId)) {
      throw this.forbiddenException();
    }
    if (current.deletedAt) return this.toSummary(current);
    if (version !== current.version) throw this.conflictException();

    const deleted = await this.prisma.$transaction(async (transaction) => {
      // 软删除和余额恢复必须同事务提交，避免账单不可见但余额仍包含已删除记录。
      const result = await transaction.transaction.updateMany({
        where: { id: transactionId, ledgerId, version, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 }, updatedById: userId },
      });
      if (result.count !== 1) throw this.conflictException();

      await this.applyBalanceChange(transaction, ledgerId, current.accountId, current.type, current.amountCents, 'restore');
      await transaction.transactionAuditLog.create({
        data: {
          ledgerId,
          transactionId,
          operatorId: userId,
          action: 'DELETE',
          beforeData: this.toAuditData(current),
          afterData: { ...this.toAuditData(current), deletedAt: new Date().toISOString(), version: current.version + 1 },
        },
      });
      return transaction.transaction.findUnique({ where: { id: transactionId }, select: transactionSelect });
    });
    if (!deleted) throw this.notFoundException();
    return this.toSummary(deleted);
  }

  async list(userId: string, ledgerId: string, query: TransactionQuery) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();

    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const occurredAt = this.buildDateRange(query.from, query.to);
    const keyword = query.keyword?.trim();
    const keywordCondition: Prisma.TransactionWhereInput | undefined = keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: 'insensitive' } },
            { note: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const where: Prisma.TransactionWhereInput = {
      ledgerId,
      deletedAt: null,
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.accountId === undefined ? {} : { accountId: query.accountId }),
      ...(query.payerId === undefined ? {} : { payerId: query.payerId }),
      ...(occurredAt === undefined ? {} : { occurredAt }),
      AND: [
        {
          OR: [
            { accountId: null },
            { account: { OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }] } },
          ],
        },
        ...(keywordCondition ? [keywordCondition] : []),
      ],
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: transactionSelect,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions.map((item) => this.toSummary(item)),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  private async readDetailRecord(
    userId: string,
    ledgerId: string,
    transactionId: string,
    fallback?: TransactionRecord,
  ): Promise<TransactionRecord> {
    const record = fallback ?? (await this.prisma.transaction.findFirst({
      where: { id: transactionId, ledgerId, deletedAt: null },
      select: transactionSelect,
    }));
    if (!record || record.deletedAt) throw this.notFoundException();
    if (record.account?.visibility === 'PRIVATE') {
      const account = await this.prisma.account.findFirst({
        where: { id: record.account.id, ledgerId, ownerId: userId },
        select: { id: true },
      });
      if (!account) throw this.notFoundException();
    }
    return record;
  }

  private async findByClientRequestId(ledgerId: string, clientRequestId: string) {
    return this.prisma.transaction.findFirst({
      where: { ledgerId, clientRequestId, deletedAt: null },
      select: transactionSelect,
    });
  }

  private async findWritableAccount(userId: string, ledgerId: string, accountId: string) {
    return this.prisma.account.findFirst({
      where: {
        id: accountId,
        ledgerId,
        isActive: true,
        OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }],
      },
      select: { id: true, ledgerId: true, ownerId: true, visibility: true, isActive: true },
    });
  }

  private async applyBalanceChange(
    transaction: {
      account: { updateMany: (args: { where: object; data: object }) => Promise<{ count: number }> };
    },
    ledgerId: string,
    accountId: string | null,
    type: string,
    amountCents: number,
    direction: 'restore' | 'apply',
  ) {
    if (!accountId) return;
    const isExpense = type === 'EXPENSE';
    const shouldIncrement = direction === 'restore' ? isExpense : !isExpense;
    const result = await transaction.account.updateMany({
      where: { id: accountId, ledgerId },
      data: { currentBalanceCents: shouldIncrement ? { increment: amountCents } : { decrement: amountCents } },
    });
    if (result.count !== 1) throw this.notFoundException();
  }

  private buildDateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (from === undefined && to === undefined) return undefined;
    const range: Prisma.DateTimeFilter = {};
    const fromDate = from === undefined ? undefined : new Date(from);
    const toDate = to === undefined ? undefined : new Date(to);
    if (fromDate && Number.isNaN(fromDate.getTime())) throw this.invalidInputException();
    if (toDate && Number.isNaN(toDate.getTime())) throw this.invalidInputException();
    if (fromDate) range.gte = fromDate;
    if (toDate) range.lt = toDate;
    if (fromDate && toDate && fromDate >= toDate) throw this.invalidInputException();
    return range;
  }

  private async getMembership(userId: string, ledgerId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toAuditData(record: TransactionRecord) {
    return {
      id: record.id,
      type: record.type,
      amountCents: record.amountCents,
      occurredAt: record.occurredAt.toISOString(),
      categoryId: record.categoryId,
      accountId: record.accountId,
      payerId: record.payerId,
      title: record.title,
      note: record.note,
      version: record.version,
    };
  }

  private toSummary(record: TransactionRecord): TransactionSummary {
    return record;
  }

  private invalidInputException(): BadRequestException {
    return new BadRequestException({ code: 40021, message: '账单参数不合法', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40321, message: '当前成员不能管理账单', data: null });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40421, message: '账单资源不存在', data: null });
  }

  private idempotencyConflictException(): ConflictException {
    return new ConflictException({ code: 40922, message: '幂等请求处理冲突，请重试', data: null });
  }

  private conflictException(): ConflictException {
    return new ConflictException({ code: 40922, message: '账单版本冲突，请刷新后重试', data: null });
  }
}
