import assert from 'node:assert/strict';
import type { AxiosAdapter } from 'axios';
import {
  CategoryIconStorageError,
  completeCategoryIconUpload,
  createCategoryIconUploadSession,
  getCategoryIconAccessUrl,
  getCategoryIconLibrary,
  getCategories,
  restoreDefaultCategoryIcon,
  uploadCategoryIconObject,
} from '../src/lib/api/category-api';
import { userClient } from '../src/lib/api/user-client';

type AdapterConfig = Parameters<AxiosAdapter>[0];
type CapturedRequest = { method?: string; url?: string; params?: unknown; data?: unknown };

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  try {
    let captured: CapturedRequest | undefined;
    const current = (): CapturedRequest => captured as CapturedRequest;
    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { method: config.method, url: config.url, params: config.params, data: config.data };
      return Promise.resolve({
        data: {
          success: true,
          code: 0,
          message: '操作成功',
          data: { items: [], total: 0, page: 1, pageSize: 100, hasNextPage: false },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };

    const result = await getCategories('ledger/with slash', {
      page: 1,
      pageSize: 100,
      type: 'EXPENSE',
      includeInactive: false,
    });

    assert.deepEqual(result.items, []);
    assert.equal(captured?.url, '/ledgers/ledger%2Fwith%20slash/categories');
    assert.deepEqual(captured?.params, {
      page: 1,
      pageSize: 100,
      type: 'EXPENSE',
      includeInactive: false,
    });

    captured = undefined;
    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { method: config.method, url: config.url, params: config.params, data: config.data };
      return Promise.resolve({
        data: {
          success: true,
          code: 0,
          message: '操作成功',
          data: {
            items: [{ key: 'tabler:wallet', label: '钱包', aliases: ['wallet'], group: '账户', defaultTypes: ['EXPENSE'] }],
            total: 1,
            page: 1,
            pageSize: 40,
            hasNextPage: false,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };
    const library = await getCategoryIconLibrary('ledger-1', { type: 'EXPENSE', q: '钱包' });
    assert.equal(library.items[0]?.key, 'tabler:wallet');
    assert.equal(current().method, 'get');
    assert.equal(current().url, '/ledgers/ledger-1/category-icons/library');
    assert.deepEqual(current().params, { type: 'EXPENSE', q: '钱包' });

    const session = {
      assetId: 'asset-1',
      status: 'PENDING' as const,
      uploadMethod: 'PUT' as const,
      uploadUrl: 'https://oss.example/upload',
      requiredHeaders: { 'Content-Type': 'image/png' },
      expiresAt: '2026-11-10T09:00:00.000Z',
    };
    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { method: config.method, url: config.url, params: config.params, data: config.data };
      return Promise.resolve({
        data: { success: true, code: 0, message: '操作成功', data: session },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };
    await createCategoryIconUploadSession('ledger-1', {
      clientRequestId: 'request-1',
      fileName: 'icon.png',
      mimeType: 'image/png',
      sizeBytes: 128,
    });
    assert.equal(current().method, 'post');
    assert.equal(current().url, '/ledgers/ledger-1/category-icon-assets/upload-sessions');
    assert.deepEqual(JSON.parse(String(current().data)), {
      clientRequestId: 'request-1',
      fileName: 'icon.png',
      mimeType: 'image/png',
      sizeBytes: 128,
    });

    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { method: config.method, url: config.url, params: config.params, data: config.data };
      return Promise.resolve({
        data: {
          success: true,
          code: 0,
          message: '操作成功',
          data: { assetId: 'asset-1', status: 'ATTACHED', mimeType: 'image/png', sizeBytes: 128, accessUrl: 'https://oss.example/read', accessUrlExpiresAt: '2026-11-10T09:00:00.000Z' },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };
    await completeCategoryIconUpload('ledger-1', 'asset/1');
    assert.equal(current().method, 'post');
    assert.equal(current().url, '/ledgers/ledger-1/category-icon-assets/asset%2F1/complete');

    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { method: config.method, url: config.url, params: config.params, data: config.data };
      return Promise.resolve({
        data: { success: true, code: 0, message: '操作成功', data: { assetId: 'asset-1', accessUrl: 'https://oss.example/read', accessUrlExpiresAt: '2026-11-10T09:00:00.000Z' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };
    await getCategoryIconAccessUrl('ledger-1', 'asset-1');
    assert.equal(current().method, 'get');
    assert.equal(current().url, '/ledgers/ledger-1/category-icon-assets/asset-1/access-url');

    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { method: config.method, url: config.url, params: config.params, data: config.data };
      return Promise.resolve({
        data: { success: true, code: 0, message: '操作成功', data: { id: 'category-1' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };
    await restoreDefaultCategoryIcon('ledger-1', 'category-1');
    assert.equal(current().method, 'post');
    assert.equal(current().url, '/ledgers/ledger-1/categories/category-1/restore-default-icon');

    const originalFetch = globalThis.fetch;
    let fetchCall: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = async (url, init) => {
      fetchCall = { url: String(url), init };
      return new Response(null, { status: 200 });
    };
    try {
      await uploadCategoryIconObject(
        'https://oss.example/upload',
        'PUT',
        { 'Content-Type': 'image/png' },
        new Blob(['png']),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(fetchCall?.url, 'https://oss.example/upload');
    assert.equal(fetchCall?.init?.method, 'PUT');
    assert.deepEqual(fetchCall?.init?.headers, { 'Content-Type': 'image/png' });
    assert.equal(fetchCall?.init?.credentials, 'omit');
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(
      uploadCategoryIconObject('https://oss.example/expired', 'PUT', {}, new Blob(['png'])),
      (error: unknown) => error instanceof CategoryIconStorageError && error.status === 403,
    );
    console.log('category api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
