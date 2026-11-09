import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttachmentController } from './attachment.controller';
import { CreateAttachmentUploadDto } from './dto/create-attachment-upload.dto';
import { AttachmentService } from './attachment.service';

describe('AttachmentController', () => {
  it('给定上传请求，当创建会话，则传递认证用户、账本、账单和附件字段', async () => {
    const service = { createUploadSession: jest.fn().mockResolvedValue({ attachmentId: 'a1' }) };
    const controller = new AttachmentController(service as unknown as AttachmentService);

    await controller.createUpload({ id: 'user-1' }, 'ledger-1', 'tx-1', {
      clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    });

    expect(service.createUploadSession).toHaveBeenCalledWith('user-1', 'ledger-1', 'tx-1', {
      clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    });
  });

  it('给定不支持的 MIME 或超大文件，当校验 DTO，则返回字段错误', () => {
    const badMime = plainToInstance(CreateAttachmentUploadDto, {
      clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
      fileName: 'receipt.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 100,
    });
    const tooLarge = plainToInstance(CreateAttachmentUploadDto, {
      clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 11 * 1024 * 1024,
    });

    expect(validateSync(badMime).some(({ property }) => property === 'mimeType')).toBe(true);
    expect(validateSync(tooLarge).some(({ property }) => property === 'sizeBytes')).toBe(true);
  });

  it('给定完成、读取和删除请求，当 Controller 接收路径，则传递认证用户和资源标识', async () => {
    const service = {
      complete: jest.fn().mockResolvedValue({ id: 'a1' }),
      getAccessUrl: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue(null),
    };
    const controller = new AttachmentController(service as unknown as AttachmentService);

    await controller.complete({ id: 'user-1' }, 'ledger-1', 'a1');
    await controller.accessUrl({ id: 'user-1' }, 'ledger-1', 'a1');
    await controller.remove({ id: 'user-1' }, 'ledger-1', 'tx-1', 'a1');

    expect(service.complete).toHaveBeenCalledWith('user-1', 'ledger-1', 'a1');
    expect(service.getAccessUrl).toHaveBeenCalledWith('user-1', 'ledger-1', 'a1');
    expect(service.remove).toHaveBeenCalledWith('user-1', 'ledger-1', 'tx-1', 'a1');
  });
});
