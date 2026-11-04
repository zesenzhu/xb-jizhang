import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import type { CategoryQuery, CreateCategoryInput, UpdateCategoryInput } from './category.types';

@Controller('ledgers/:ledgerId/categories')
@UseGuards(AuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryCategoriesDto,
  ) {
    return this.categoryService.list(user.id, ledgerId, query as CategoryQuery);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    const input: CreateCategoryInput = {
      type: dto.type,
      name: dto.name,
      parentId: dto.parentId,
      sortOrder: dto.sortOrder,
      icon: dto.icon,
      color: dto.color,
    };
    return this.categoryService.create(user.id, ledgerId, input);
  }

  @Patch(':categoryId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const input: UpdateCategoryInput = {
      name: dto.name,
      parentId: dto.parentId,
      sortOrder: dto.sortOrder,
      icon: dto.icon,
      color: dto.color,
      isActive: dto.isActive,
    };
    return this.categoryService.update(user.id, ledgerId, categoryId, input);
  }
}
