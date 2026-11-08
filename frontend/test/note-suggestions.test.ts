import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNoteSuggestions } from '../src/lib/api/note-api';
import { userClient } from '../src/lib/api/user-client';

/**
 * 历史备注候选契约。
 *
 * 排序、去重、200 字过滤和「只取当前用户」都在服务端；前端不得自行重排或补数据，
 * 否则会绕过服务端的账本隔离与隐私口径。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const requests: Array<{ method?: string; url?: string; params?: unknown }> = [];

  try {
    userClient.defaults.adapter = async (config) => {
      requests.push({ method: config.method, url: config.url, params: config.params });
      return {
        data: {
          success: true,
          code: 0,
          message: 'ok',
          data: {
            items: [
              { text: '午餐', lastUsedAt: '2026-11-08T12:30:00.000Z' },
              { text: '地铁通勤', lastUsedAt: '2026-11-07T08:15:00.000Z' },
            ],
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    // 默认取 10 条，路径必须落在账本下而不是全局备注。
    const result = await getNoteSuggestions('ledger-1');
    assert.equal(requests[0]?.method, 'get');
    assert.equal(requests[0]?.url, '/ledgers/ledger-1/note-suggestions');
    assert.deepEqual(requests[0]?.params, { limit: 10 });
    // 顺序必须原样透传，前端不得按文本或时间重排。
    assert.deepEqual(result.items.map((item) => item.text), ['午餐', '地铁通勤']);

    // 自定义上限透传；账本 ID 需要编码，避免特殊字符串到别的路径。
    await getNoteSuggestions('ledger/../admin', 5);
    assert.equal(requests[1]?.url, '/ledgers/ledger%2F..%2Fadmin/note-suggestions');
    assert.deepEqual(requests[1]?.params, { limit: 5 });
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }

  // 组件侧契约：空候选不占位；点击只回填文本，不提交、不改写文本。
  const bar = readFileSync(join(srcRoot, 'components/bill/NoteSuggestionBar.tsx'), 'utf8');
  assert.ok(
    /if \(suggestions\.length === 0\) return null;/.test(bar),
    '无候选时必须返回 null，不能在编辑条里留空白占位',
  );
  assert.ok(
    /onClick=\{\(\) => onSelect\(suggestion\.text\)\}/.test(bar),
    '点击候选只能回填原始文本',
  );
  assert.ok(
    !/onSubmit|onSave/.test(bar),
    '候选栏不得持有提交能力，避免误触直接记账',
  );
  assert.ok(
    bar.includes('aria-label="历史备注候选"'),
    '候选栏需要可读名称',
  );

  // 抽屉侧契约：只请求 10 条，保证与服务端上限一致。
  const sheet = readFileSync(join(srcRoot, 'components/bill/BillCreateSheet.tsx'), 'utf8');
  assert.ok(
    /getNoteSuggestions\(ledgerId, 10\)/.test(sheet),
    '记账抽屉必须按 10 条请求候选',
  );

  console.log('note suggestions contract passed');
})();
