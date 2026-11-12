import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TransactionSummary } from '../src/lib/api/transaction-types';
import { BillRow } from '../src/components/bill/BillRow';

const bill: TransactionSummary = {
  id: 'bill-1',
  ledgerId: 'ledger-1',
  type: 'EXPENSE',
  amountCents: 600,
  occurredAt: '2026-11-10T03:34:00.000Z',
  title: null,
  note: null,
  categoryId: 'category-1',
  accountId: null,
  fromAccountId: null,
  toAccountId: null,
  transferGroupId: null,
  source: 'MANUAL',
  clientRequestId: 'request-1',
  createdById: 'user-1',
  updatedById: 'user-1',
  payerId: null,
  version: 1,
  deletedAt: null,
  createdAt: '2026-11-10T03:34:00.000Z',
  updatedAt: '2026-11-10T03:34:00.000Z',
  category: {
    id: 'category-1',
    type: 'EXPENSE',
    name: '娱乐休闲',
    parentId: null,
    icon: 'tabler:confetti',
    iconSource: 'LIBRARY',
    iconKey: 'tabler:confetti',
    iconAssetId: null,
    defaultKey: 'expense.entertainment',
    iconUrl: null,
    iconUrlExpiresAt: null,
    color: '#F59E0B',
  },
  account: null,
  payer: null,
  attachments: [
    {
      id: 'attachment-1',
      transactionId: 'bill-1',
      status: 'ATTACHED',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      originalName: 'receipt.jpg',
      createdAt: '2026-11-10T03:34:00.000Z',
    },
  ],
  attachmentCount: 1,
};

const markup = renderToStaticMarkup(React.createElement(BillRow, { bill }));

assert.match(markup, /<svg[^>]*aria-hidden="true"/, '账单列表应显示分类图标而不是分类首字');
assert.ok(!markup.includes('>娱<\/span>'), '分类图标可用时不应显示分类首字');
assert.match(markup, /纸夹|1/, '带附件的账单列表仍应显示附件数量');
assert.ok(!markup.includes('receipt.jpg'), '附件文件名不应替代分类 Icon');

console.log('bill row category icon contract passed');
