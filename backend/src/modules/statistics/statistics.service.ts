import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StatisticsOverview, StatisticsQuery } from './statistics.types';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
  ): Promise<StatisticsOverview> {
    const member = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();

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
    const visibilityCondition: Prisma.TransactionWhereInput = {
      OR: [
        { accountId: null },
        { account: { OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }] } },
      ],
    };
    const where: Prisma.TransactionWhereInput = {
      ledgerId,
      deletedAt: null,
      type: query.type ?? { in: ['EXPENSE', 'INCOME'] },
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.accountId === undefined ? {} : { accountId: query.accountId }),
      ...(query.payerId === undefined ? {} : { payerId: query.payerId }),
      ...(occurredAt === undefined ? {} : { occurredAt }),
      AND: [visibilityCondition, ...(keywordCondition ? [keywordCondition] : [])],
    };

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amountCents: true },
      _count: { id: true },
    });
    const totalIncomeCents = this.sumByType(grouped, 'INCOME');
    const totalExpenseCents = this.sumByType(grouped, 'EXPENSE');
    const transactionCount = grouped.reduce((total, item) => total + item._count.id, 0);
    return {
      from: query.from ?? null,
      to: query.to ?? null,
      totalIncomeCents,
      totalExpenseCents,
      netCents: totalIncomeCents - totalExpenseCents,
      transactionCount,
    };
  }

  private sumByType(
    grouped: Array<{
      type: string;
      _sum: { amountCents: number | null };
      _count: { id: number };
    }>,
    type: 'EXPENSE' | 'INCOME',
  ): number {
    return grouped.find((item) => item.type === type)?._sum.amountCents ?? 0;
  }

  private buildDateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (from === undefined && to === undefined) return undefined;
    const fromDate = from === undefined ? undefined : new Date(from);
    const toDate = to === undefined ? undefined : new Date(to);
    if (fromDate && Number.isNaN(fromDate.getTime())) throw this.invalidInputException();
    if (toDate && Number.isNaN(toDate.getTime())) throw this.invalidInputException();
    if (fromDate && toDate && fromDate >= toDate) throw this.invalidInputException();
    return {
      ...(fromDate === undefined ? {} : { gte: fromDate }),
      ...(toDate === undefined ? {} : { lt: toDate }),
    };
  }

  private invalidInputException(): BadRequestException {
    return new BadRequestException({ code: 40021, message: '统计参数不合法', data: null });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40421, message: '账本资源不存在', data: null });
  }
}
