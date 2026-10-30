import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminPermissionGuard } from '../common/admin-permission.guard';
import { RequireAdminPermission } from '../common/admin-permission.decorator';
import { AdminAuditService } from './admin-audit.service';
import type { AdminAuditQuery } from './admin-audit.types';
import { QueryAdminAuditLogsDto } from './dto/query-admin-audit-logs.dto';

@Controller('admin/audit-logs')
@UseGuards(AdminAuthGuard, AdminPermissionGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @RequireAdminPermission('admin:audit:read')
  list(@Query() query: QueryAdminAuditLogsDto) {
    return this.auditService.list(this.toAuditQuery(query));
  }

  private toAuditQuery(query: QueryAdminAuditLogsDto): AdminAuditQuery {
    return {
      page: query.page,
      pageSize: query.pageSize,
      adminUserId: query.adminUserId,
      action: query.action,
      targetType: query.targetType,
      targetId: query.targetId,
      result: query.result,
      requestId: query.requestId,
      createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
      createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
    };
  }
}
