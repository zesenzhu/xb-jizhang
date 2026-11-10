import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { CategoryIconService } from './category-icon.service';
import { CreateCategoryIconUploadDto } from './dto/create-category-icon-upload.dto';
import { QueryCategoryIconLibraryDto } from './dto/query-category-icon-library.dto';
import type {
  CategoryIconLibraryQuery,
  CreateCategoryIconUploadInput,
} from './category-icon.types';

@Controller('ledgers/:ledgerId')
@UseGuards(AuthGuard)
export class CategoryIconController {
  constructor(private readonly categoryIconService: CategoryIconService) {}

  @Get('category-icons/library')
  listLibrary(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryCategoryIconLibraryDto,
  ) {
    return this.categoryIconService.listLibrary(
      user.id,
      ledgerId,
      query as CategoryIconLibraryQuery,
    );
  }

  @Post('category-icon-assets/upload-sessions')
  async createUploadSession(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Body() dto: CreateCategoryIconUploadDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.categoryIconService.createUploadSession(
      user.id,
      ledgerId,
      dto as CreateCategoryIconUploadInput,
    );
    response.status(result.reused ? HttpStatus.OK : HttpStatus.CREATED);
    return result.asset;
  }

  @Post('category-icon-assets/:assetId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.categoryIconService.complete(user.id, ledgerId, assetId);
  }

  @Get('category-icon-assets/:assetId/access-url')
  getAccessUrl(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.categoryIconService.getAccessUrl(user.id, ledgerId, assetId);
  }
}
