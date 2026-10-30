import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminAuditInput } from '../common/admin.types';
import type { AdminAuditQuery } from './admin-audit.types';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'jwtsecret',
  'databaseurl',
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.replaceAll('_', '').replaceAll('-', '').toLowerCase());
}

type SafeJsonValue =
  | null
  | string
  | number
  | boolean
  | SafeJsonValue[]
  | { [key: string]: SafeJsonValue };

function sanitizeAuditValue(value: unknown): SafeJsonValue {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item));
  if (typeof value === 'object') {
    const objectValue: { [key: string]: SafeJsonValue } = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      objectValue[key] = isSensitiveKey(key) ? '[REDACTED]' : sanitizeAuditValue(nestedValue);
    }
    return objectValue;
  }
  return '[UNSERIALIZABLE]';
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    transaction: PrismaClient | Prisma.TransactionClient,
    input: AdminAuditInput,
  ) {
    return transaction.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        requestId: input.requestId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason?.trim(),
        // Prisma 区分顶层 JSON null；脱敏函数已保证运行时值是可序列化 JSON。
        beforeData:
          input.beforeData === undefined
            ? undefined
            : (sanitizeAuditValue(input.beforeData) as Prisma.InputJsonValue),
        afterData:
          input.afterData === undefined
            ? undefined
            : (sanitizeAuditValue(input.afterData) as Prisma.InputJsonValue),
        result: input.result,
        errorCode: input.errorCode,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }

  async list(query: AdminAuditQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.adminUserId ? { adminUserId: query.adminUserId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.createdFrom || query.createdTo
        ? { createdAt: { gte: query.createdFrom, lte: query.createdTo } }
        : {}),
    };
    const select = {
      id: true,
      requestId: true,
      action: true,
      targetType: true,
      targetId: true,
      reason: true,
      beforeData: true,
      afterData: true,
      result: true,
      errorCode: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      adminUser: { select: { id: true, username: true, displayName: true } },
    } as const;
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  get client(): PrismaService {
    return this.prisma;
  }
}

export { sanitizeAuditValue };
