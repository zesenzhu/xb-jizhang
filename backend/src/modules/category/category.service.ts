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
  CategoryQuery,
  CategorySummary,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.types';

const categorySelect = {
  id: true,
  ledgerId: true,
  type: true,
  name: true,
  icon: true,
  color: true,
  sortOrder: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CategoryRecord = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, ledgerId: string, query: CategoryQuery) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (query.includeInactive && member.role !== 'OWNER') throw this.forbiddenException();

    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const where: Prisma.CategoryWhereInput = {
      ledgerId,
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(query.includeInactive ? {} : { isActive: true }),
    };
    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: categorySelect,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      items: categories.map((category) => this.toSummary(category)),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async create(
    userId: string,
    ledgerId: string,
    input: CreateCategoryInput,
  ): Promise<CategorySummary> {
    await this.requireOwner(userId, ledgerId);
    const name = input.name.trim();
    if (!name) throw this.invalidNameException();

    try {
      const category = await this.prisma.category.create({
        data: {
          ledgerId,
          type: input.type,
          name,
          sortOrder: input.sortOrder ?? 0,
          isSystem: false,
          ...(input.icon === undefined ? {} : { icon: input.icon }),
          ...(input.color === undefined ? {} : { color: input.color }),
        },
        select: categorySelect,
      });
      return this.toSummary(category);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw this.duplicateException();
      throw error;
    }
  }

  async update(
    userId: string,
    ledgerId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<CategorySummary> {
    await this.requireOwner(userId, ledgerId);
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, ledgerId },
      select: categorySelect,
    });
    if (!category) throw this.notFoundException();
    if (input.name !== undefined && !input.name.trim()) throw this.invalidNameException();

    const data: Prisma.CategoryUpdateManyMutationInput = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };

    try {
      const updated = await this.prisma.category.updateMany({
        where: { id: categoryId, ledgerId },
        data,
      });
      if (updated.count !== 1) throw this.notFoundException();
    } catch (error) {
      if (isUniqueConstraintError(error)) throw this.duplicateException();
      throw error;
    }

    const latest = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: categorySelect,
    });
    if (!latest || latest.ledgerId !== ledgerId) throw this.notFoundException();
    return this.toSummary(latest);
  }

  private async requireOwner(userId: string, ledgerId: string) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (member.role !== 'OWNER') throw this.forbiddenException();
    return member;
  }

  private async getMembership(userId: string, ledgerId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
  }

  private toSummary(category: CategoryRecord): CategorySummary {
    return category;
  }

  private invalidNameException(): BadRequestException {
    return new BadRequestException({ code: 40021, message: '分类名称不能为空', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40321, message: '当前成员不能管理分类', data: null });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40421, message: '分类资源不存在', data: null });
  }

  private duplicateException(): ConflictException {
    return new ConflictException({ code: 40921, message: '同类型分类名称已存在', data: null });
  }
}
