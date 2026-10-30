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
import { AdminLedgerService } from './admin-ledger.service';
import type {
  AdminLedgerQuery,
  AdminLedgerRequestMetadata,
  UpdateLedgerStatusInput,
} from './admin-ledger.types';
import { QueryAdminLedgersDto } from './dto/query-admin-ledgers.dto';
import { UpdateLedgerStatusDto } from './dto/update-ledger-status.dto';

@Controller('admin/ledgers')
@UseGuards(AdminAuthGuard, AdminPermissionGuard)
export class AdminLedgerController {
  constructor(private readonly ledgerService: AdminLedgerService) {}

  @Get()
  @RequireAdminPermission('admin:ledger:read')
  list(@Query() query: QueryAdminLedgersDto) {
    return this.ledgerService.list(this.toLedgerQuery(query));
  }

  @Get(':ledgerId')
  @RequireAdminPermission('admin:ledger:read')
  getDetail(@Param('ledgerId') ledgerId: string) {
    return this.ledgerService.getDetail(ledgerId);
  }

  @Patch(':ledgerId/status')
  @RequireAdminPermission('admin:ledger:status')
  updateStatus(
    @Param('ledgerId') ledgerId: string,
    @Body() dto: UpdateLedgerStatusDto,
    @Req() request: AdminAuthenticatedRequest,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.ledgerService.updateStatus(
      ledgerId,
      this.toStatusInput(dto),
      this.getAdminUser(request),
      this.getRequestMetadata(request, userAgent),
    );
  }

  private toLedgerQuery(query: QueryAdminLedgersDto): AdminLedgerQuery {
    return {
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword,
      status: query.status,
      type: query.type,
    };
  }

  private toStatusInput(dto: UpdateLedgerStatusDto): UpdateLedgerStatusInput {
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
  ): AdminLedgerRequestMetadata {
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
