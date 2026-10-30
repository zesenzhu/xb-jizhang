import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AccountQuery,
  AccountSummary,
  CreateAccountInput,
  UpdateAccountInput,
} from './account.types';

const accountSelect = {
  id: true,
  ledgerId: true,
  ownerId: true,
  name: true,
  type: true,
  visibility: true,
  initialBalanceCents: true,
  currentBalanceCents: true,
  includeInAssets: true,
  icon: true,
  color: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AccountRecord = Prisma.AccountGetPayload<{ select: typeof accountSelect }>;

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, ledgerId: string, query: AccountQuery) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (query.includeInactive && member.role === 'VIEWER') throw this.forbiddenException();

    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const visibleAccounts: Prisma.AccountWhereInput[] =
      query.includeInactive && member.role !== 'OWNER'
        ? [{ visibility: 'PRIVATE', ownerId: userId }]
        : [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }];
    const where: Prisma.AccountWhereInput = {
      ledgerId,
      ...(query.includeInactive ? {} : { isActive: true }),
      OR: visibleAccounts,
    };
    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: accountSelect,
      }),
      this.prisma.account.count({ where }),
    ]);

    return {
      items: accounts.map((account) => this.toSummary(account)),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async create(
    userId: string,
    ledgerId: string,
    input: CreateAccountInput,
  ): Promise<AccountSummary> {
    const member = await this.requireActiveMember(userId, ledgerId);
    const name = input.name.trim();
    if (!name) throw this.invalidNameException();

    if (input.visibility === 'SHARED' && member.role !== 'OWNER') {
      throw this.forbiddenException();
    }
    if (input.visibility === 'PRIVATE' && !['OWNER', 'EDITOR'].includes(member.role)) {
      throw this.forbiddenException();
    }

    const initialBalanceCents = input.initialBalanceCents ?? 0;
    const account = await this.prisma.account.create({
      data: {
        ledgerId,
        ownerId: input.visibility === 'PRIVATE' ? userId : null,
        name,
        type: input.type,
        visibility: input.visibility,
        initialBalanceCents,
        currentBalanceCents: initialBalanceCents,
        includeInAssets: input.includeInAssets ?? true,
        ...(input.icon === undefined ? {} : { icon: input.icon }),
        ...(input.color === undefined ? {} : { color: input.color }),
      },
      select: accountSelect,
    });

    return this.toSummary(account);
  }

  async update(
    userId: string,
    ledgerId: string,
    accountId: string,
    input: UpdateAccountInput,
  ): Promise<AccountSummary> {
    const member = await this.requireActiveMember(userId, ledgerId);
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        ledgerId,
        OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }],
      },
      select: accountSelect,
    });
    if (!account) throw this.notFoundException();

    const canManage =
      account.visibility === 'SHARED'
        ? member.role === 'OWNER'
        : account.ownerId === userId && ['OWNER', 'EDITOR'].includes(member.role);
    if (!canManage) throw this.forbiddenException();

    if (input.name !== undefined && !input.name.trim()) {
      throw this.invalidNameException();
    }

    const data: Prisma.AccountUpdateManyMutationInput = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.includeInAssets === undefined ? {} : { includeInAssets: input.includeInAssets }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      ...(input.color === undefined ? {} : { color: input.color }),
    };
    const updated = await this.prisma.account.updateMany({
      where: { id: accountId, ledgerId },
      data,
    });
    if (updated.count !== 1) throw this.notFoundException();

    const latest = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: accountSelect,
    });
    if (!latest || latest.ledgerId !== ledgerId) throw this.notFoundException();
    return this.toSummary(latest);
  }

  private async requireActiveMember(userId: string, ledgerId: string) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    return member;
  }

  private async getMembership(userId: string, ledgerId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
  }

  private toSummary(account: AccountRecord): AccountSummary {
    return account;
  }

  private invalidNameException(): BadRequestException {
    return new BadRequestException({ code: 40021, message: '账户名称不能为空', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40321, message: '当前成员不能管理该账户', data: null });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40421, message: '账户资源不存在', data: null });
  }
}
