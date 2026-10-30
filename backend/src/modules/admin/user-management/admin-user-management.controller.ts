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
import { AdminUserManagementService } from './admin-user-management.service';
import type {
  AdminUserRequestMetadata,
  AdminUserQuery,
  UpdateUserStatusInput,
} from './admin-user-management.types';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('admin/users')
@UseGuards(AdminAuthGuard, AdminPermissionGuard)
export class AdminUserManagementController {
  constructor(private readonly userService: AdminUserManagementService) {}

  @Get()
  @RequireAdminPermission('admin:user:read')
  list(@Query() query: QueryAdminUsersDto) {
    return this.userService.list(this.toUserQuery(query));
  }

  @Get(':userId')
  @RequireAdminPermission('admin:user:read')
  getDetail(@Param('userId') userId: string) {
    return this.userService.getDetail(userId);
  }

  @Patch(':userId/status')
  @RequireAdminPermission('admin:user:status')
  updateStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: AdminAuthenticatedRequest,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.userService.updateStatus(
      userId,
      this.toStatusInput(dto),
      this.getAdminUser(request),
      this.getRequestMetadata(request, userAgent),
    );
  }

  private toUserQuery(query: QueryAdminUsersDto): AdminUserQuery {
    return {
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword,
      status: query.status,
      createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
      createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
    };
  }

  private toStatusInput(dto: UpdateUserStatusDto): UpdateUserStatusInput {
    return {
      status: dto.status,
      reason: dto.reason,
      updatedAt: new Date(dto.updatedAt),
    };
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
