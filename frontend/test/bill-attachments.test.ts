import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TransactionAttachmentSummary } from '../src/lib/api/attachment-types';
import {
  attachmentIdsNeedingUrl,
  firstAttachedAttachment,
} from '../src/lib/bill/bill-attachments';

const attachment = (
  id: string,
  status: TransactionAttachmentSummary['status'] = 'ATTACHED',
  accessUrl?: string,
): TransactionAttachmentSummary => ({
  id,
  status,
  transactionId: 'transaction-1',
  mimeType: 'image/jpeg',
  sizeBytes: 10,
  originalName: `${id}.jpg`,
  ...(accessUrl ? { accessUrl } : {}),
  createdAt: '2026-11-10T08:00:00.000Z',
});

assert.deepEqual(
  attachmentIdsNeedingUrl([
    attachment('ready'),
    attachment('resolved', 'ATTACHED', 'https://cdn.example/resolved.jpg'),
    attachment('pending', 'PENDING'),
  ]),
  ['ready'],
);
assert.deepEqual(
  attachmentIdsNeedingUrl([attachment('ready')]),
  ['ready'],
  '详情首屏应主动为无访问地址的已完成附件获取预览地址',
);
assert.deepEqual(
  attachmentIdsNeedingUrl([attachment('ready'), attachment('other')], new Set(['ready'])),
  ['other'],
);
assert.equal(firstAttachedAttachment([attachment('pending', 'PENDING'), attachment('ready')])?.id, 'ready');
assert.equal(firstAttachedAttachment([attachment('pending', 'PENDING')]), undefined);

// 给定编辑态已有附件，当新增图片并保存账单，则必须走附件上传队列，不能只更新账单字段。
const containerPath = fileURLToPath(new URL('../src/components/bill/BillDetailContainer.tsx', import.meta.url));
const detailContainer = readFileSync(join(containerPath), 'utf8');
assert.ok(detailContainer.includes('uploadAttachmentQueue'), '编辑态必须接入附件上传队列');
assert.ok(detailContainer.includes('existingAttachmentCount={attachments.length}'), '编辑态必须把已有附件计入上限');
assert.match(
  detailContainer,
  /const savedBill = await saveMutation\.mutateAsync\(\);[\s\S]*const attachmentsUploaded = await uploadDrafts\(savedBill\.id\);/,
  '字段保存成功后必须上传新增附件',
);
assert.ok(detailContainer.includes('onRetryAttachments'), '附件上传失败后必须保留重试入口');

console.log('bill attachments contract passed');
