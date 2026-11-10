import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CategoryIconSource } from '@prisma/client';
import { DEFAULT_ICON_METADATA } from './category.constants';
import { CategoryIconService } from '../category-icon/category-icon.service';
import { PrismaService } from '../prisma/prisma.service';
import { isCategoryIconLibraryKey } from '../category-icon/category-icon.constants';
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
  parentId: true,
  icon: true,
  iconSource: true,
  iconKey: true,
  iconAssetId: true,
  defaultKey: true,
  color: true,
  sortOrder: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof categorySelect;
}>;

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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly categoryIconService?: CategoryIconService,
  ) {}

  async list(userId: string, ledgerId: string, query: CategoryQuery) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (query.includeInactive && member.role !== 'OWNER')
      throw this.forbiddenException();

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
      items: await Promise.all(
        categories.map((category) =>
          this.toSummary(userId, ledgerId, category),
        ),
      ),
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
    const parentId = await this.validateParent(
      ledgerId,
      input.type,
      input.parentId ?? null,
    );
    const iconPlan = this.resolveIconPlan(input);
    this.validateColor(input.color);
    const createData = {
      ledgerId,
      type: input.type,
      name,
      parentId,
      sortOrder: input.sortOrder ?? 0,
      isSystem: false,
      ...(iconPlan?.data ?? {}),
      ...(input.color === undefined ? {} : { color: input.color }),
    };

    try {
      const create = async (client: PrismaService | Prisma.TransactionClient) =>
        client.category.create({ data: createData, select: categorySelect });
      const category = iconPlan?.iconAssetId
        ? await this.withBindableAsset(
            ledgerId,
            iconPlan.iconAssetId,
            null,
            create,
          )
        : await create(this.prisma);
      return this.toSummary(userId, ledgerId, category);
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
    if (input.name !== undefined && !input.name.trim())
      throw this.invalidNameException();
    const parentId =
      input.parentId === undefined
        ? category.parentId
        : await this.validateParent(ledgerId, category.type, input.parentId);
    if (parentId === category.id) throw this.invalidParentException();
    if (parentId !== null && category.parentId === null) {
      const childCount = await this.prisma.category.count({
        where: { parentId: category.id },
      });
      if (childCount > 0) throw this.invalidParentException();
    }
    if (input.isActive === false) {
      const activeChildCount = await this.prisma.category.count({
        where: { parentId: category.id, isActive: true },
      });
      if (activeChildCount > 0)
        throw this.invalidParentException('请先停用子分类');
    }

    const iconPlan = this.resolveIconPlan(input, category);
    this.validateColor(input.color);

    const data: Prisma.CategoryUpdateManyMutationInput = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.parentId === undefined ? {} : { parentId }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      ...(iconPlan?.data ?? {}),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };

    try {
      const update = async (
        client: PrismaService | Prisma.TransactionClient,
      ) => {
        const updated = await client.category.updateMany({
          where: { id: categoryId, ledgerId },
          data,
        });
        if (updated.count !== 1) throw this.notFoundException();
        if (
          category.iconAssetId &&
          category.iconAssetId !== (iconPlan?.iconAssetId ?? null)
        ) {
          await client.categoryIconAsset.updateMany({
            where: { id: category.iconAssetId, status: 'ATTACHED' },
            data: { status: 'DELETED', deletedAt: new Date() },
          });
        }
        return client.category.findUnique({
          where: { id: categoryId },
          select: categorySelect,
        });
      };
      const needsIconTransaction = Boolean(
        iconPlan && (iconPlan.iconAssetId || category.iconAssetId),
      );
      const latest = needsIconTransaction
        ? await this.withBindableAsset(
            ledgerId,
            iconPlan?.iconAssetId ?? null,
            categoryId,
            update,
          )
        : await update(this.prisma);
      if (!latest || latest.ledgerId !== ledgerId)
        throw this.notFoundException();
      return this.toSummary(userId, ledgerId, latest);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw this.duplicateException();
      throw error;
    }
  }

  async restoreDefaultIcon(
    userId: string,
    ledgerId: string,
    categoryId: string,
  ): Promise<CategorySummary> {
    await this.requireOwner(userId, ledgerId);
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, ledgerId },
      select: categorySelect,
    });
    if (!category || !category.isSystem || !category.defaultKey)
      throw this.notFoundException();
    const metadata = DEFAULT_ICON_METADATA[category.defaultKey];
    if (!metadata) throw this.invalidIconException();

    try {
      const restored = await this.prisma.$transaction(async (transaction) => {
        if (category.iconAssetId) {
          await transaction.categoryIconAsset.updateMany({
            where: { id: category.iconAssetId, status: 'ATTACHED' },
            data: { status: 'DELETED', deletedAt: new Date() },
          });
        }
        const updated = await transaction.category.updateMany({
          where: { id: categoryId, ledgerId },
          data: {
            icon: metadata.iconKey,
            iconSource: 'LIBRARY',
            iconKey: metadata.iconKey,
            iconAssetId: null,
            color: metadata.color,
          },
        });
        if (updated.count !== 1) throw this.notFoundException();
        return transaction.category.findUnique({
          where: { id: categoryId },
          select: categorySelect,
        });
      });
      if (!restored) throw this.notFoundException();
      return this.toSummary(userId, ledgerId, restored);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw this.duplicateException();
      throw error;
    }
  }

  private async requireOwner(userId: string, ledgerId: string) {
    const member = await this.getMembership(userId, ledgerId);
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (member.role !== 'OWNER') throw this.forbiddenException();
    return member;
  }

  /** 父级必须是当前账本同类型的一级分类，避免跨账本引用和三级分类。 */
  private async validateParent(
    ledgerId: string,
    type: CategorySummary['type'],
    parentId: string | null | undefined,
  ): Promise<string | null> {
    if (parentId === null || parentId === undefined) return null;
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, ledgerId, type, isActive: true },
      select: { id: true, parentId: true },
    });
    if (!parent) throw this.notFoundException();
    if (parent.parentId !== null) throw this.invalidParentException();
    return parent.id;
  }

  private async getMembership(userId: string, ledgerId: string) {
    return this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
  }

  private async toSummary(
    userId: string,
    ledgerId: string,
    category: CategoryRecord,
  ): Promise<CategorySummary> {
    if (!('iconSource' in category))
      return category as unknown as CategorySummary;
    let iconUrl: string | null = null;
    let iconUrlExpiresAt: Date | null = null;
    if (
      category.iconSource === 'IMAGE' &&
      category.iconAssetId &&
      this.categoryIconService
    ) {
      const signed = await this.categoryIconService.getBoundIconUrl(
        userId,
        ledgerId,
        category.iconAssetId,
      );
      iconUrl = signed?.url ?? null;
      iconUrlExpiresAt = signed?.expiresAt ?? null;
    }
    return {
      ...category,
      icon:
        category.icon ??
        (category.iconSource === 'LIBRARY' ? category.iconKey : null),
      iconUrl,
      iconUrlExpiresAt,
    };
  }

  private resolveIconPlan(
    input: CreateCategoryInput | UpdateCategoryInput,
    current?: CategoryRecord,
  ): CategoryIconPlan | null {
    const hasStructuredFields =
      input.iconSource !== undefined ||
      input.iconKey !== undefined ||
      input.iconAssetId !== undefined;
    if (!hasStructuredFields) {
      if (input.icon === undefined) return null;
      const legacyIcon = input.icon;
      if (legacyIcon && isCategoryIconLibraryKey(legacyIcon)) {
        return {
          iconAssetId: null,
          data: {
            icon: legacyIcon,
            iconSource: 'LIBRARY',
            iconKey: legacyIcon,
            iconAssetId: null,
          },
        };
      }
      return {
        iconAssetId: null,
        data: {
          icon: legacyIcon,
          iconSource: 'NONE',
          iconKey: null,
          iconAssetId: null,
        },
      };
    }

    const source = input.iconSource ?? current?.iconSource;
    if (!source) throw this.invalidIconException();
    if (source === 'NONE') {
      if (input.iconKey != null || input.iconAssetId != null)
        throw this.invalidIconException();
      return {
        iconAssetId: null,
        data: {
          icon: null,
          iconSource: 'NONE',
          iconKey: null,
          iconAssetId: null,
        },
      };
    }
    if (source === 'LIBRARY') {
      const iconKey =
        input.iconKey ??
        (input.iconSource === undefined ? current?.iconKey : null);
      if (!iconKey || !isCategoryIconLibraryKey(iconKey))
        throw this.invalidIconException();
      if (input.iconAssetId != null) throw this.invalidIconException();
      return {
        iconAssetId: null,
        data: {
          icon: iconKey,
          iconSource: 'LIBRARY',
          iconKey,
          iconAssetId: null,
        },
      };
    }
    if (source === 'IMAGE') {
      const iconAssetId =
        input.iconAssetId ??
        (input.iconSource === undefined ? current?.iconAssetId : null);
      if (!iconAssetId || input.iconKey != null)
        throw this.invalidIconException();
      return {
        iconAssetId,
        data: { icon: null, iconSource: 'IMAGE', iconKey: null, iconAssetId },
      };
    }
    throw this.invalidIconException();
  }

  private async withBindableAsset<T>(
    ledgerId: string,
    assetId: string | null,
    categoryId: string | null,
    operation: (client: PrismaService | Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!this.categoryIconService) throw this.storageUnavailableException();
    return this.prisma.$transaction(async (transaction) => {
      if (assetId)
        await this.categoryIconService!.validateBindableAsset(
          transaction,
          ledgerId,
          assetId,
          categoryId,
        );
      return operation(transaction);
    });
  }

  private validateColor(color: string | null | undefined): void {
    if (
      color !== undefined &&
      color !== null &&
      !/^#[0-9A-Fa-f]{6}$/.test(color)
    ) {
      throw this.invalidIconException();
    }
  }

  private invalidNameException(): BadRequestException {
    return new BadRequestException({
      code: 40021,
      message: '分类名称不能为空',
      data: null,
    });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({
      code: 40321,
      message: '当前成员不能管理分类',
      data: null,
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({
      code: 40421,
      message: '分类资源不存在',
      data: null,
    });
  }

  private duplicateException(): ConflictException {
    return new ConflictException({
      code: 40921,
      message: '同类型分类名称已存在',
      data: null,
    });
  }

  private invalidParentException(
    message = '分类父级必须是同类型一级分类',
  ): BadRequestException {
    return new BadRequestException({ code: 40021, message, data: null });
  }

  private invalidIconException(): BadRequestException {
    return new BadRequestException({
      code: 40021,
      message: '分类图标参数组合不合法',
      data: null,
    });
  }

  private storageUnavailableException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 50341,
      message: '对象存储暂不可用或分类图标功能已关闭',
      data: null,
    });
  }
}

interface CategoryIconPlan {
  iconAssetId: string | null;
  data: {
    icon: string | null;
    iconSource: CategoryIconSource;
    iconKey: string | null;
    iconAssetId: string | null;
  };
}
