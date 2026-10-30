import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail, SafeUser, toSafeUser } from '../auth/auth.types';
import { UpdateUserInput } from './user.types';

const safeUserSelect = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });
    if (!user || !user.isActive) throw new UnauthorizedException('登录状态已失效');
    return toSafeUser(user);
  }

  async updateMe(userId: string, input: UpdateUserInput): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.nickname !== undefined ? { nickname: input.nickname?.trim() || null } : {}),
          ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
          ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
        },
        select: safeUserSelect,
      });
      return toSafeUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException('邮箱已被占用');
      throw error;
    }
  }
}
