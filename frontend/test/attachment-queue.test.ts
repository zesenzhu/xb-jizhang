import assert from 'node:assert/strict';
import { AxiosError, type AxiosAdapter } from 'axios';
import { uploadAttachmentQueue } from '../src/lib/bill/attachment-queue';
import type { AttachmentDraft } from '../src/lib/api/attachment-types';
import { userClient } from '../src/lib/api/user-client';

function okResponse(config: Parameters<AxiosAdapter>[0], data: unknown) {
  return Promise.resolve({
    data: { success: true, code: 0, message: '操作成功', data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

function apiFailure(config: Parameters<AxiosAdapter>[0], code: number, message: string) {
  const response = {
    data: { success: false, code, message, data: null },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config,
  };
  return Promise.reject(new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, response));
}

function draft(localId: string): AttachmentDraft {
  return {
    localId,
    clientRequestId: `request-${localId}`,
    file: { name: `${localId}.jpg`, type: 'image/jpeg', size: 100 } as File,
    previewUrl: `blob:${localId}`,
    status: 'LOCAL',
    error: null,
  };
}

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const originalFetch = globalThis.fetch;
  const progress: Array<{ localId: string; status: string; error: string | null }> = [];
  const completeAttempts: string[] = [];
  const completeCalls: string[] = [];
  let activeUploads = 0;
  let maxActiveUploads = 0;

  userClient.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/attachment-uploads')) {
      const input = JSON.parse(String(config.data)) as { clientRequestId: string };
      const localId = input.clientRequestId.replace('request-', '');
      if (localId === 'create-fail') return apiFailure(config, 50341, '对象存储不可用');
      if (localId === 'attached') {
        return okResponse(config, {
          attachmentId: 'attachment-attached',
          status: 'ATTACHED',
          uploadMethod: 'PUT',
          uploadUrl: 'https://storage.example.test/already-attached',
          requiredHeaders: {},
          expiresAt: '2026-11-09T12:41:00.000Z',
        });
      }
      return okResponse(config, {
        attachmentId: `attachment-${localId}`,
        status: 'PENDING',
        uploadMethod: 'PUT',
        uploadUrl: `https://storage.example.test/${localId}`,
        requiredHeaders: { 'X-Local-Id': localId },
        expiresAt: '2026-11-09T12:41:00.000Z',
      });
    }
    if (config.url?.endsWith('/complete')) {
      const attachmentId = String(config.url).split('/').at(-2);
      completeAttempts.push(attachmentId ?? '');
      if (attachmentId === 'attachment-complete-fail') {
        return apiFailure(config, 50341, '完成上传失败');
      }
      completeCalls.push(attachmentId ?? '');
      return okResponse(config, {
        id: attachmentId,
        status: 'ATTACHED',
        transactionId: 'transaction-1',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        originalName: `${attachmentId}.jpg`,
        createdAt: '2026-11-09T12:31:00.000Z',
        attachmentCount: 1,
      });
    }
    return okResponse(config, null);
  };

  try {
    globalThis.fetch = async (input, init) => {
      activeUploads += 1;
      maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeUploads -= 1;
      if (String(input).endsWith('/upload-fail')) {
        return { ok: false, status: 403 } as Response;
      }
      return { ok: true, status: 200 } as Response;
    };

    const drafts = [
      draft('one'),
      draft('upload-fail'),
      draft('complete-fail'),
      draft('attached'),
      draft('create-fail'),
    ];
    await uploadAttachmentQueue({
      ledgerId: 'ledger-1',
      transactionId: 'transaction-1',
      drafts,
      concurrency: 2,
      onProgress: ({ localId, status, error }) => progress.push({ localId, status, error }),
    });

    assert.ok(maxActiveUploads <= 2, `上传并发超过限制：${maxActiveUploads}`);
    for (const localId of drafts.map((item) => item.localId)) {
      const events = progress.filter((item) => item.localId === localId);
      assert.equal(events[0]?.status, 'UPLOADING');
      assert.ok(['ATTACHED', 'FAILED'].includes(events.at(-1)?.status ?? ''));
    }
    assert.equal(progress.find((item) => item.localId === 'one' && item.status === 'ATTACHED')?.error, null);
    assert.equal(progress.find((item) => item.localId === 'attached' && item.status === 'ATTACHED')?.error, null);
    assert.match(
      progress.find((item) => item.localId === 'upload-fail' && item.status === 'FAILED')?.error ?? '',
      /对象存储上传失败/,
    );
    assert.equal(
      progress.find((item) => item.localId === 'complete-fail' && item.status === 'FAILED')?.error,
      '完成上传失败',
    );
    assert.equal(
      progress.find((item) => item.localId === 'create-fail' && item.status === 'FAILED')?.error,
      '对象存储不可用',
    );
    assert.deepEqual(completeAttempts.sort(), ['attachment-complete-fail', 'attachment-one']);
    assert.deepEqual(completeCalls, ['attachment-one']);
    console.log('attachment queue passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
    globalThis.fetch = originalFetch;
  }
})();
