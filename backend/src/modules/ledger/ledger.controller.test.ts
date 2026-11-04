import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { UpdateLedgerDto } from './dto/update-ledger.dto';

describe('LedgerController', () => {
  it('给定有效与无效时区和币种，当校验账本 DTO，则只接受服务端支持的值', () => {
    const valid = plainToInstance(CreateLedgerDto, {
      name: '纽约', type: 'PERSONAL', timezone: 'America/New_York', defaultCurrency: 'USD',
    });
    const invalidCreate = plainToInstance(CreateLedgerDto, {
      name: '无效', type: 'PERSONAL', timezone: 'Mars/Olympus', defaultCurrency: 'ZZZ',
    });
    const invalidUpdate = plainToInstance(UpdateLedgerDto, {
      timezone: 'Mars/Olympus', defaultCurrency: 'ZZZ', updatedAt: '2026-10-30T08:00:00.000Z',
    });
    expect(validateSync(valid)).toHaveLength(0);
    expect(validateSync(plainToInstance(CreateLedgerDto, {
      name: 'Etc', type: 'PERSONAL', timezone: 'Etc/GMT+8',
    }))).toHaveLength(0);
    expect(validateSync(invalidCreate)).toHaveLength(2);
    expect(validateSync(invalidUpdate)).toHaveLength(2);
  });

  it('给定 ICU 短名 CST，当校验创建与更新 DTO，则均拒绝时区字段', () => {
    const create = plainToInstance(CreateLedgerDto, { name: '歧义', type: 'PERSONAL', timezone: 'CST' });
    const update = plainToInstance(UpdateLedgerDto, {
      timezone: 'CST', updatedAt: '2026-10-30T08:00:00.000Z',
    });

    expect(validateSync(create).map((error) => error.property)).toContain('timezone');
    expect(validateSync(update).map((error) => error.property)).toContain('timezone');
  });

  it('给定合法 Etc 时区，当校验更新 DTO，则允许该时区', () => {
    const update = plainToInstance(UpdateLedgerDto, {
      timezone: 'Etc/GMT+8', updatedAt: '2026-10-30T08:00:00.000Z',
    });

    expect(validateSync(update)).toHaveLength(0);
  });
  it('给定带归档参数的账本列表请求，当用户查询账本，则把查询参数和认证用户传入 Service', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new LedgerController(service as unknown as LedgerService);

    await controller.list({ id: 'user-1' }, { page: 2, pageSize: 10, includeArchived: true });

    expect(service.list).toHaveBeenCalledWith('user-1', {
      page: 2,
      pageSize: 10,
      includeArchived: true,
    });
  });

  it('给定创建账本请求，当 Controller 接收参数，则只把允许字段传入 Service', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'ledger-1' }) };
    const controller = new LedgerController(service as unknown as LedgerService);

    await controller.create(
      { id: 'user-1' },
      { name: '家庭账本', type: 'SHARED', defaultCurrency: 'CNY' },
    );

    expect(service.create).toHaveBeenCalledWith('user-1', {
      name: '家庭账本',
      type: 'SHARED',
      defaultCurrency: 'CNY',
      timezone: undefined,
      icon: undefined,
      color: undefined,
    });
  });

  it('给定时区和币种，当创建或修改账本，则传递可写字段且忽略归档字段', async () => {
    const service = { create: jest.fn(), update: jest.fn() };
    const controller = new LedgerController(service as unknown as LedgerService);
    await controller.create({ id: 'user-1' }, {
      name: '纽约', type: 'PERSONAL', timezone: 'America/New_York', defaultCurrency: 'USD',
    });
    await controller.update({ id: 'user-1' }, 'ledger-1', {
      timezone: 'America/New_York', defaultCurrency: 'USD', isArchived: true,
      updatedAt: '2026-10-30T08:00:00.000Z',
    } as UpdateLedgerDto);
    expect(service.create).toHaveBeenCalledWith('user-1', expect.objectContaining({ timezone: 'America/New_York' }));
    expect(service.update).toHaveBeenCalledWith('user-1', 'ledger-1', expect.objectContaining({
      timezone: 'America/New_York', defaultCurrency: 'USD',
    }));
    expect(service.update.mock.calls[0][2]).not.toHaveProperty('isArchived');
  });
});
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateLedgerDto } from './dto/create-ledger.dto';
