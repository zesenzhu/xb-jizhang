import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import type { AdminContext } from '../common/admin.types';
import type {
  AdminLedgerQuery,
  AdminLedgerRequestMetadata,
  UpdateLedgerStatusInput,
} from './admin-ledger.types';

const adminLedgerSelect = {
  id: true,
  name: true,
  type: true,
  defaultCurrency: true,
  isArchived: true,
  creator: { select: { id: true, username: true, nickname: true } },
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true, transactions: true } },
} as const;

type AdminLedgerRecord = Prisma.LedgerGetPayload<{ select: typeof adminLedgerSelect }>;

function toAdminLedgerSummary(ledger: AdminLedgerRecord) {
  return {
    id: ledger.id,
    name: ledger.name,
    type: ledger.type,
    defaultCurrency: ledger.defaultCurrency,
    isArchived: ledger.isArchived,
    creator: ledger.creator,
    memberCount: ledger._count.members,
    transactionCount: ledger._count.transactions,
    createdAt: ledger.createdAt,
    updatedAt: ledger.updatedAt,
  };
}

@Injectable()
export class AdminLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly permissionService: AdminPermissionService,
  ) {}

  async list(query: AdminLedgerQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const where: Prisma.LedgerWhereInput = {
      ...(query.keyword
        ? { name: { contains: query.keyword, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { isArchived: query.status === 'ARCHIVED' } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ledger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: adminLedgerSelect,
      }),
      this.prisma.ledger.count({ where }),
    ]);

    return {
      items: items.map(toAdminLedgerSummary),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async getDetail(ledgerId: string) {
    const ledger = await this.prisma.ledger.findUnique({
      where: { id: ledgerId },
      select: adminLedgerSelect,
    });
    if (!ledger) throw this.notFoundException();
    return toAdminLedgerSummary(ledger);
  }

  async updateStatus(
    ledgerId: string,
    input: UpdateLedgerStatusInput,
    operator: AdminContext,
    metadata: AdminLedgerRequestMetadata,
  ) {
    const reason = this.permissionService.requireAuditReason(input.reason);
    const before = await this.prisma.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true, name: true, isArchived: true, updatedAt: true },
    });
    if (!before) throw this.notFoundException();
    if (before.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw this.conflictException();
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.ledger.updateMany({
        where: { id: ledgerId, updatedAt: before.updatedAt },
        data: { isArchived: input.status === 'ARCHIVED' },
      });
      if (updateResult.count !== 1) throw this.conflictException();

      const after = await transaction.ledger.findUnique({
        where: { id: ledgerId },
        select: adminLedgerSelect,
      });
      if (!after) throw this.notFoundException();

      await this.auditService.record(transaction, {
        adminUserId: operator.id,
        requestId: metadata.requestId,
        action: 'admin.ledger.status',
        targetType: 'Ledger',
        targetId: ledgerId,
        reason,
        beforeData: { isArchived: before.isArchived },
        afterData: { isArchived: after.isArchived },
        result: 'SUCCESS',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

      return toAdminLedgerSummary(after);
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({
      code: 40402,
      message: '管理端资源不存在',
      data: null,
    });
  }

  private conflictException(): ConflictException {
    return new ConflictException({
      code: 40902,
      message: '资源版本已变化，请刷新后重试',
      data: null,
    });
  }
}
