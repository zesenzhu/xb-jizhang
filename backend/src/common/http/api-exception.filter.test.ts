import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const createHost = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ExecutionContext;
    return { response, host };
  };

  it('给定认证异常，当过滤响应，则返回统一认证错误结构', () => {
    const filter = new ApiExceptionFilter();
    const { response, host } = createHost();

    filter.catch(new UnauthorizedException('登录状态已失效'), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      code: 40101,
      message: '登录状态已失效',
      data: null,
    });
  });

  it('给定字段校验异常，当过滤响应，则保留结构化校验详情', () => {
    const filter = new ApiExceptionFilter();
    const { response, host } = createHost();

    filter.catch(new BadRequestException({ message: ['密码长度不符合要求'] }), host);

    expect(response.json).toHaveBeenCalledWith({
      success: false,
      code: 40001,
      message: '请求参数校验失败',
      data: { details: ['密码长度不符合要求'] },
    });
  });
});
