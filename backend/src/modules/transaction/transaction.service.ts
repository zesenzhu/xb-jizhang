import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Temporal } from '@js-temporal/polyfill';
import type { TransactionType } from '@prisma/client';
import { CategoryIconService } from '../category-icon/category-icon.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateTransactionInput,
  NoteSuggestion,
  TransactionQuery,
  TransactionSummary,
  UpdateTransactionInput,
} from './transaction.types';

const transactionScalarSelect = {
  id: true,
  ledgerId: true,
  type: true,
  amountCents: true,
  occurredAt: true,
  title: true,
  note: true,
  noteUpdatedAt: true,
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
} as const;

const transactionSelect = {
  ...transactionScalarSelect,
  createdBy: { select: { id: true, username: true, nickname: true, avatar: true } },
  category: {
    select: {
      id: true,
      type: true,
      name: true,
      parentId: true,
      icon: true,
      iconSource: true,
      iconKey: true,
      iconAssetId: true,
      defaultKey: true,
      color: true,
    },
  },
  account: { select: { id: true, name: true, visibility: true } },
  payer: { select: { id: true, nickname: true } },
  attachments: {
    where: { status: 'ATTACHED', deletedAt: null },
    select: {
      id: true,
      transactionId: true,
      status: true,
      mimeType: true,
      sizeBytes: true,
      originalName: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      attachments: { where: { status: 'ATTACHED', deletedAt: null } },
    },
  },
} as const;

type TransactionRecord = Prisma.TransactionGetPayload<{ select: typeof transactionSelect }>;
type TransactionScalarRecord = Prisma.TransactionGetPayload<{ select: typeof transactionScalarSelect }>;
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly categoryIconService?: CategoryIconService,
  ) {}

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

    const occurredAt = this.parseOccurredAt(input.occurredAt);
    const normalizedNote = this.normalizeOptionalText(input.note);

    const existing = await this.findByClientRequestId(ledgerId, input.clientRequestId);
    if (existing) return this.toSummary(existing, userId);

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
            note: normalizedNote,
            noteUpdatedAt: normalizedNote ? new Date() : null,
            categoryId: input.categoryId,
            accountId: input.accountId ?? null,
            source: 'MANUAL',
            clientRequestId: input.clientRequestId,
            createdById: userId,
            updatedById: userId,
            payerId: input.payerId ?? null,
          },
          select: transactionScalarSelect,
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
        return createdTransaction.id;
      });

      return this.toSummary(await this.readDetailRecord(userId, ledgerId, created), userId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrent = await this.findByClientRequestId(ledgerId, input.clientRequestId);
        if (concurrent) return this.toSummary(concurrent, userId);
        throw this.idempotencyConflictException();
      }
      throw error;
    }
  }

  async getDetail(userId: string, ledgerId: string, transactionId: string): Promise<TransactionSummary> {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    const record = await this.readDetailRecord(userId, ledgerId, transactionId);
    return this.toSummary(record, userId);
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
    const nextOccurredAt =
      input.occurredAt === undefined ? current.occurredAt : this.parseOccurredAt(input.occurredAt);
    if (!['EXPENSE', 'INCOME'].includes(nextType) || !Number.isInteger(nextAmount) || nextAmount <= 0) {
      throw this.invalidInputException();
    }
    const nextNote = input.note === undefined ? current.note : this.normalizeOptionalText(input.note);

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

    const updatedId = await this.prisma.$transaction(async (transaction) => {
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
          note: nextNote,
          noteUpdatedAt:
            nextNote === null
              ? null
              : nextNote !== current.note
                ? new Date()
                : current.noteUpdatedAt,
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
            note: nextNote,
            noteUpdatedAt:
              nextNote === null
                ? null
                : nextNote !== current.note
                  ? new Date()
                  : current.noteUpdatedAt,
            version: current.version + 1,
          },
        },
      });
      return transactionId;
    });
    return this.toSummary(await this.readDetailRecord(userId, ledgerId, updatedId), userId);
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
    if (current.deletedAt) return this.toSummary(current, userId);
    if (version !== current.version) throw this.conflictException();

    const deletedId = await this.prisma.$transaction(async (transaction) => {
      // 软删除和余额恢复必须同事务提交，避免账单不可见但余额仍包含已删除记录。
      const result = await transaction.transaction.updateMany({
        where: { id: transactionId, ledgerId, version, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 }, updatedById: userId },
      });
      if (result.count !== 1) throw this.conflictException();

      await this.applyBalanceChange(transaction, ledgerId, current.accountId, current.type, current.amountCents, 'restore');
      await transaction.transactionAttachment.updateMany({
        where: { transactionId, status: { in: ['PENDING', 'ATTACHED'] } },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
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
      return transactionId;
    });
    return this.toSummary(
      await this.readDetailRecord(userId, ledgerId, deletedId, undefined, true),
      userId,
    );
  }

  /**
   * 备注候选只取当前用户在当前账本创建的备注，按 noteUpdatedAt 倒序去重。
   * 不按 Transaction.updatedAt 排序，避免修改金额等无关字段把旧备注顶到最前。
   */
  async getNoteSuggestions(
    userId: string,
    ledgerId: string,
    limit = 10,
  ): Promise<{ items: NoteSuggestion[] }> {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();

    const rows = await this.prisma.$queryRaw<NoteSuggestion[]>(Prisma.sql`
      SELECT text, last_used_at AS "lastUsedAt"
      FROM (
        SELECT DISTINCT ON (btrim(note))
          btrim(note) AS text,
          note_updated_at AS last_used_at
        FROM "transaction"
        WHERE ledger_id = ${ledgerId}
          AND created_by_id = ${userId}
          AND deleted_at IS NULL
          AND note IS NOT NULL
          AND note_updated_at IS NOT NULL
          AND btrim(note) <> ''
          AND char_length(btrim(note)) <= 200
        ORDER BY btrim(note), note_updated_at DESC, created_at DESC
      ) AS suggestions
      ORDER BY last_used_at DESC
      LIMIT ${limit}
    `);
    return { items: rows };
  }

  async list(userId: string, ledgerId: string, query: TransactionQuery) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (
      (query.categoryId !== undefined && query.categoryRootId !== undefined) ||
      (query.uncategorized === true &&
        (query.categoryId !== undefined || query.categoryRootId !== undefined))
    ) {
      throw this.invalidCategoryFilterException();
    }

    if (query.categoryRootId !== undefined && query.uncategorized !== true) {
      const categoryRoot = await this.prisma.category.findFirst({
        where: { id: query.categoryRootId, ledgerId },
        select: { id: true, parentId: true },
      });
      if (!categoryRoot) throw this.notFoundException();
      if (categoryRoot.parentId !== null) throw this.invalidCategoryFilterException();
    }

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
      ...(query.uncategorized === true
        ? { categoryId: null }
        : query.categoryId === undefined
          ? {}
          : { categoryId: query.categoryId }),
      ...(query.uncategorized === true || query.categoryRootId === undefined ? {} : {
        OR: [
          { categoryId: query.categoryRootId },
          { category: { parentId: query.categoryRootId } },
        ],
      }),
      ...(query.accountId === undefined ? {} : { accountId: query.accountId }),
      ...(query.payerId === undefined ? {} : { payerId: query.payerId }),
      ...(query.createdById === undefined ? {} : { createdById: query.createdById }),
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
      items: await Promise.all(transactions.map((item) => this.toSummary(item, userId))),
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
    includeDeleted = false,
  ): Promise<TransactionRecord> {
    const record = fallback ?? (await this.prisma.transaction.findFirst({
      where: { id: transactionId, ledgerId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: transactionSelect,
    }));
    if (!record || (!includeDeleted && record.deletedAt)) throw this.notFoundException();
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

  /**
   * 严格解析带时区的 ISO instant：日期-only、无偏移本地时间和非法日历日期都拒绝，
   * 避免 `new Date('2026-11-08T20:30')` 按服务进程时区解释。
   */
  private parseOccurredAt(value: string): Date {
    try {
      return new Date(Number(Temporal.Instant.from(value).epochMilliseconds));
    } catch {
      throw this.invalidInputException();
    }
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

  private toAuditData(record: TransactionScalarRecord) {
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
      noteUpdatedAt: record.noteUpdatedAt?.toISOString() ?? null,
      version: record.version,
    };
  }

  private async toSummary(record: TransactionRecord, userId: string): Promise<TransactionSummary> {
    const { _count, ...summary } = record;
    // Prisma 查询始终带回图标元数据；类型断言同时保留旧测试/旧数据响应的兼容降级。
    let category = record.category as TransactionSummary['category'];
    if (category && 'iconSource' in category) {
      let iconUrl: string | null = null;
      let iconUrlExpiresAt: Date | null = null;
      if (
        category.iconSource === 'IMAGE' &&
        category.iconAssetId &&
        this.categoryIconService
      ) {
        const signed = await this.categoryIconService.getBoundIconUrl(
          userId,
          record.ledgerId,
          category.iconAssetId,
        );
        iconUrl = signed?.url ?? null;
        iconUrlExpiresAt = signed?.expiresAt ?? null;
      }
      category = { ...category, iconUrl, iconUrlExpiresAt };
    }
    return {
      ...summary,
      category,
      attachmentCount: _count?.attachments ?? summary.attachments?.length ?? 0,
    };
  }

  private invalidInputException(): BadRequestException {
    return new BadRequestException({ code: 40021, message: '账单参数不合法', data: null });
  }

  private invalidCategoryFilterException(): BadRequestException {
    return new BadRequestException({ code: 40023, message: '分类筛选参数不合法', data: null });
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
