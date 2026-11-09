import assert from 'node:assert/strict';
import type { AxiosAdapter } from 'axios';
import {
  AttachmentStorageError,
  completeAttachmentUpload,
  createAttachmentUpload,
  deleteAttachment,
  getAttachmentAccessUrl,
  uploadAttachmentObject,
} from '../src/lib/api/attachment-api';
import { userClient } from '../src/lib/api/user-client';

interface CapturedStorageRequest {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}

function okResponse(config: Parameters<AxiosAdapter>[0], data: unknown) {
  return Promise.resolve({
    data: { success: true, code: 0, message: '操作成功', data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const originalFetch = globalThis.fetch;
  const requests: Array<{ method?: string; url?: string; data?: unknown }> = [];
  const storageRequests: CapturedStorageRequest[] = [];
  const file = new Blob(['image-content'], { type: 'image/jpeg' });

  userClient.defaults.adapter = async (config) => {
    requests.push({ method: config.method, url: config.url, data: config.data });
    if (config.url?.endsWith('/attachment-uploads')) {
      return okResponse(config, {
        attachmentId: 'attachment-1',
        status: 'PENDING',
        uploadMethod: 'PUT',
        uploadUrl: 'https://storage.example.test/upload/attachment-1',
        requiredHeaders: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-11-09T12:41:00.000Z',
      });
    }
    if (config.url?.endsWith('/complete')) {
      return okResponse(config, {
        id: 'attachment-1',
        status: 'ATTACHED',
        transactionId: 'transaction/1',
        mimeType: 'image/jpeg',
        sizeBytes: 13,
        originalName: 'receipt.jpg',
        accessUrl: 'https://storage.example.test/read/attachment-1',
        accessUrlExpiresAt: '2026-11-09T12:36:00.000Z',
        createdAt: '2026-11-09T12:31:00.000Z',
        attachmentCount: 1,
      });
    }
    if (config.url?.endsWith('/access-url')) {
      return okResponse(config, {
        attachmentId: 'attachment-1',
        accessUrl: 'https://storage.example.test/read/attachment-1',
        accessUrlExpiresAt: '2026-11-09T12:36:00.000Z',
      });
    }
    return okResponse(config, null);
  };

  try {
    globalThis.fetch = async (input, init) => {
      storageRequests.push({ input, init });
      return { ok: true, status: 200 } as Response;
    };

    const session = await createAttachmentUpload('ledger/1', 'transaction/1', {
      clientRequestId: 'request-1',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 13,
    });
    await uploadAttachmentObject(session.uploadUrl, session.requiredHeaders, file);
    const completed = await completeAttachmentUpload('ledger/1', session.attachmentId);
    const accessUrl = await getAttachmentAccessUrl('ledger/1', session.attachmentId);
    const deleted = await deleteAttachment('ledger/1', 'transaction/1', session.attachmentId);

    assert.equal(session.status, 'PENDING');
    assert.equal(completed.status, 'ATTACHED');
    assert.equal(accessUrl.accessUrl, 'https://storage.example.test/read/attachment-1');
    assert.equal(deleted, null);
    assert.deepEqual(storageRequests[0], {
      input: 'https://storage.example.test/upload/attachment-1',
      init: {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: file,
        credentials: 'omit',
      },
    });

    const createRequest = requests[0];
    assert.equal(createRequest?.method, 'post');
    assert.equal(createRequest?.url, '/ledgers/ledger%2F1/transactions/transaction%2F1/attachment-uploads');
    assert.deepEqual(JSON.parse(String(createRequest?.data)), {
      clientRequestId: 'request-1',
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 13,
    });
    assert.equal(requests[1]?.url, '/ledgers/ledger%2F1/attachments/attachment-1/complete');
    assert.equal(requests[2]?.url, '/ledgers/ledger%2F1/attachments/attachment-1/access-url');
    assert.equal(
      requests[3]?.url,
      '/ledgers/ledger%2F1/transactions/transaction%2F1/attachments/attachment-1',
    );
    assert.equal(requests[3]?.method, 'delete');

    globalThis.fetch = async () => ({ ok: false, status: 403 } as Response);
    await assert.rejects(
      uploadAttachmentObject('https://storage.example.test/expired', {}, file),
      (error: unknown) => error instanceof AttachmentStorageError && error.status === 403,
    );
    console.log('attachment api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
    globalThis.fetch = originalFetch;
  }
})();
