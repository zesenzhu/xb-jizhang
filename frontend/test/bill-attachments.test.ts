import assert from 'node:assert/strict';
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
  attachmentIdsNeedingUrl([attachment('ready'), attachment('other')], new Set(['ready'])),
  ['other'],
);
assert.equal(firstAttachedAttachment([attachment('pending', 'PENDING'), attachment('ready')])?.id, 'ready');
assert.equal(firstAttachedAttachment([attachment('pending', 'PENDING')]), undefined);

console.log('bill attachments contract passed');
