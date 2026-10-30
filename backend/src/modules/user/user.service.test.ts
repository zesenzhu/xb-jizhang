import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';

describe('UserService', () => {
  const user = {
    id: 'user-1',
    username: 'xiaobao',
    nickname: '小宝',
    email: 'xiaobao@example.com',
    avatar: null,
    isActive: true,
    createdAt: new Date('2026-10-30T08:00:00.000Z'),
    updatedAt: new Date('2026-10-30T08:00:00.000Z'),
  };

  const createService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    return {
      prisma,
      service: new UserService(prisma as unknown as PrismaService),
    };
  };

  it('给定有效用户，当读取个人资料，则不返回密码和会话字段', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue(user);

    const result = await dependencies.service.getMe('user-1');

    expect(result).toEqual(user);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('给定包含空白和大写的邮箱，当更新个人资料，则保存规范化邮箱', async () => {
    const dependencies = createService();
    dependencies.prisma.user.update.mockResolvedValue({
      ...user,
      email: 'new@example.com',
    });

    await dependencies.service.updateMe('user-1', {
      nickname: ' 新昵称 ',
      email: ' New@Example.com ',
    });

    expect(dependencies.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          nickname: '新昵称',
          email: 'new@example.com',
        },
      }),
    );
  });

  it('给定不存在或停用的用户，当读取个人资料，则拒绝当前会话', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue(null);

    await expect(dependencies.service.getMe('missing-user')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
