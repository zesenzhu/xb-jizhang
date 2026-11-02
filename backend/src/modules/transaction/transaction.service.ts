import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateTransactionInput,
  TransactionQuery,
  TransactionSummary,
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
  category: { select: { id: true, type: true, name: true } },
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

    const account = await this.prisma.account.findFirst({
      where: {
        id: input.accountId,
        ledgerId,
        isActive: true,
        OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }],
      },
      select: {
        id: true,
        ledgerId: true,
        ownerId: true,
        visibility: true,
        isActive: true,
      },
    });
    if (!account) throw this.notFoundException();

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
            accountId: input.accountId,
            source: 'MANUAL',
            clientRequestId: input.clientRequestId,
            createdById: userId,
            updatedById: userId,
            payerId: input.payerId ?? null,
          },
          select: transactionSelect,
        });

        const balanceChange = input.type === 'EXPENSE' ? { decrement: input.amountCents } : { increment: input.amountCents };
        const updatedAccount = await transaction.account.updateMany({
          where: { id: input.accountId, ledgerId, isActive: true },
          data: { currentBalanceCents: balanceChange },
        });
        if (updatedAccount.count !== 1) throw this.notFoundException();

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

  async list(userId: string, ledgerId: string, query: TransactionQuery) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();

    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const occurredAt = this.buildDateRange(query.from, query.to);
    const keyword = query.keyword?.trim();
    const where: Prisma.TransactionWhereInput = {
      ledgerId,
      deletedAt: null,
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.accountId === undefined ? {} : { accountId: query.accountId }),
      ...(query.payerId === undefined ? {} : { payerId: query.payerId }),
      ...(occurredAt === undefined ? {} : { occurredAt }),
      account: {
        OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }],
      },
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { note: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
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
    if (!record || record.deletedAt || !record.account) throw this.notFoundException();
    if (record.account.visibility === 'PRIVATE') {
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
}
