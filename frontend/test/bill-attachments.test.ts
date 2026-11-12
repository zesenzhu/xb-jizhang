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
  accessUrlExpiresAt?: string,
): TransactionAttachmentSummary => ({
  id,
  status,
  transactionId: 'transaction-1',
  mimeType: 'image/jpeg',
  sizeBytes: 10,
  originalName: `${id}.jpg`,
  ...(accessUrl ? { accessUrl } : {}),
  ...(accessUrlExpiresAt ? { accessUrlExpiresAt } : {}),
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
assert.deepEqual(
  attachmentIdsNeedingUrl([
    attachment('blob', 'ATTACHED', 'blob:https://app.example/old-url'),
    attachment('expired', 'ATTACHED', 'https://cdn.example/expired', '2020-01-01T00:00:00.000Z'),
    attachment('fresh', 'ATTACHED', 'https://cdn.example/fresh', '2099-01-01T00:00:00.000Z'),
  ]),
  ['blob', 'expired'],
  '详情重新打开时不得复用历史 blob URL 或过期签名地址',
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
assert.ok(
  !detailContainer.includes('queryClient.setQueryData<TransactionSummary>'),
  '附件临时访问地址不得写回账单详情缓存',
);

const galleryPath = fileURLToPath(new URL('../src/components/bill/BillAttachmentGallery.tsx', import.meta.url));
const gallery = readFileSync(join(galleryPath), 'utf8');
assert.ok(gallery.includes('const previewRequestId = React.useRef(0);'), '预览请求需要有序号，避免关闭后的异步结果回写');
assert.ok(gallery.includes('autoRefreshAttemptedIds.current.clear();'), '关闭预览时应清理图片失败重试状态');
assert.ok(gallery.includes('key={`${viewer?.id}:${viewerUrl}`}'), '预览图片需要强制重建节点，避免移动端复用失效图片节点');
assert.ok(gallery.includes('if (!open) closeViewer();'), '预览 BottomSheet 关闭时应统一清理预览状态');
const detailSheetPath = fileURLToPath(new URL('../src/components/bill/BillDetailSheet.tsx', import.meta.url));
const detailSheet = readFileSync(join(detailSheetPath), 'utf8');
assert.ok(detailSheet.includes("key={open ? 'open' : 'closed'}"), '详情关闭后不得继续复用已被父容器释放的 Blob URL');

console.log('bill attachments contract passed');
