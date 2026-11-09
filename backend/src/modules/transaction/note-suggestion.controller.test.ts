import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { NoteSuggestionsQueryDto } from './dto/note-suggestions-query.dto';
import { NoteSuggestionController } from './note-suggestion.controller';
import type { TransactionService } from './transaction.service';

describe('NoteSuggestionController 契约对齐', () => {
  it('给定合法参数，当请求历史备注，则透传认证用户、账本标识和上限', async () => {
    const service = {
      getNoteSuggestions: jest.fn().mockResolvedValue({
        items: [{ text: '午餐', lastUsedAt: '2026-11-08T12:00:00.000Z' }],
      }),
    };
    const controller = new NoteSuggestionController(service as unknown as TransactionService);

    const result = await controller.noteSuggestions({ id: 'user-1' } as never, 'ledger-1', { limit: 10 });

    expect(service.getNoteSuggestions).toHaveBeenCalledWith('user-1', 'ledger-1', 10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].text).toBe('午餐');
  });

  it('给定超出范围的 limit，当校验 DTO，则抛出字段错误', () => {
    const dto = plainToInstance(NoteSuggestionsQueryDto, { limit: 20 });
    const errors = validateSync(dto);
    expect(errors.some((err) => err.property === 'limit')).toBe(true);
  });
});
