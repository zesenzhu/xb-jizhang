import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AdminAuthenticatedRequest } from '../auth/admin-authenticated-request';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminPermissionGuard } from '../common/admin-permission.guard';
import { RequireAdminPermission } from '../common/admin-permission.decorator';
import type { AdminContext } from '../common/admin.types';
import { AdminUserService } from './admin-user.service';
import type { AdminUserQuery, AdminUserRequestMetadata, UpdateAdminUserInput } from './admin-user.types';
import { QueryAdminAccountsDto } from './dto/query-admin-users.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Controller('admin/admin-users')
@UseGuards(AdminAuthGuard, AdminPermissionGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @RequireAdminPermission('admin:admin_user:manage')
  list(@Query() query: QueryAdminAccountsDto) {
    const adminQuery: AdminUserQuery = {
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword,
      status: query.status,
    };
    return this.adminUserService.list(adminQuery);
  }

  @Patch(':adminUserId')
  @RequireAdminPermission('admin:admin_user:manage')
  update(
    @Param('adminUserId') adminUserId: string,
    @Body() dto: UpdateAdminUserDto,
    @Req() request: AdminAuthenticatedRequest,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const input: UpdateAdminUserInput = {
      isActive: dto.isActive,
      roleCodes: dto.roleCodes,
      reason: dto.reason,
      updatedAt: new Date(dto.updatedAt),
    };
    return this.adminUserService.update(
      adminUserId,
      input,
      this.getAdminUser(request),
      this.getRequestMetadata(request, userAgent),
    );
  }

  private getAdminUser(request: AdminAuthenticatedRequest): AdminContext {
    if (!request.adminUser) {
      throw new UnauthorizedException({
        code: 40103,
        message: '管理员登录状态已失效',
        data: null,
      });
    }
    return request.adminUser;
  }

  private getRequestMetadata(
    request: AdminAuthenticatedRequest,
    userAgent?: string,
  ): AdminUserRequestMetadata {
    const requestIdHeader = request.headers['x-request-id'];
    return {
      requestId:
        typeof requestIdHeader === 'string' && requestIdHeader.trim()
          ? requestIdHeader
          : randomUUID(),
      ip: request.ip,
      userAgent,
    };
  }
}
