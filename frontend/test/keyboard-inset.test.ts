import assert from 'node:assert/strict';
import {
  FALLBACK_VIEWPORT_METRICS,
  KEYBOARD_OPEN_THRESHOLD,
  VIEWPORT_STABLE_DELTA,
  computeViewportMetrics,
  shouldApplyViewportUpdate,
} from '../src/lib/viewport/use-visual-viewport';

/**
 * 键盘覆盖模型的核心：系统键盘不改变布局视口，只压缩 visualViewport。
 * 编辑条的位置完全由 keyboardInset 决定，算错就会浮在键盘中间或沉到键盘下面。
 */

// 键盘收起：可视视口等于布局视口，没有键盘占位。
assert.deepEqual(
  computeViewportMetrics({ viewportHeight: 844, viewportOffsetTop: 0, layoutHeight: 844 }),
  { height: 844, offsetTop: 0, keyboardInset: 0, isKeyboardOpen: false },
);

// 键盘弹出：可视视口被压缩 336px，占位应等于差值。
const keyboardOpen = computeViewportMetrics({
  viewportHeight: 508,
  viewportOffsetTop: 0,
  layoutHeight: 844,
});
assert.equal(keyboardOpen.keyboardInset, 336);
assert.equal(keyboardOpen.isKeyboardOpen, true);

// iOS 被系统滚动时 offsetTop > 0，必须从占位里扣掉，避免重复计算让编辑条悬空。
assert.equal(
  computeViewportMetrics({ viewportHeight: 508, viewportOffsetTop: 40, layoutHeight: 844 })
    .keyboardInset,
  296,
);

// 地址栏收起等小幅变化不应判定为键盘打开。
assert.equal(
  computeViewportMetrics({ viewportHeight: 844 - KEYBOARD_OPEN_THRESHOLD, viewportOffsetTop: 0, layoutHeight: 844 })
    .isKeyboardOpen,
  false,
);
assert.equal(
  computeViewportMetrics({ viewportHeight: 844 - KEYBOARD_OPEN_THRESHOLD - 1, viewportOffsetTop: 0, layoutHeight: 844 })
    .isKeyboardOpen,
  true,
);

// 异常输入不能算出负键盘高度，否则编辑条会被推到屏幕外。
assert.equal(
  computeViewportMetrics({ viewportHeight: 900, viewportOffsetTop: 0, layoutHeight: 844 }).keyboardInset,
  0,
);
assert.equal(
  computeViewportMetrics({ viewportHeight: 0, viewportOffsetTop: 0, layoutHeight: 0 }).keyboardInset,
  0,
);

// 无 visualViewport 的桌面环境使用回退值，且不谎报键盘打开。
assert.deepEqual(FALLBACK_VIEWPORT_METRICS, {
  height: 0,
  offsetTop: 0,
  keyboardInset: 0,
  isKeyboardOpen: false,
});

// 键盘动画期间会连续上报中间值；小于步长的抖动不得写入状态，否则底部区会来回重排。
const closed = computeViewportMetrics({ viewportHeight: 844, viewportOffsetTop: 0, layoutHeight: 844 });
const almostOpen = computeViewportMetrics({
  viewportHeight: 844 - KEYBOARD_OPEN_THRESHOLD - 1,
  viewportOffsetTop: 0,
  layoutHeight: 844,
});
assert.equal(
  shouldApplyViewportUpdate(closed, almostOpen),
  true,
  '开合状态翻转必须采纳',
);

const opened = computeViewportMetrics({ viewportHeight: 508, viewportOffsetTop: 0, layoutHeight: 844 });
const jittered = computeViewportMetrics({
  viewportHeight: 508 + VIEWPORT_STABLE_DELTA - 1,
  viewportOffsetTop: 0,
  layoutHeight: 844,
});
assert.equal(
  shouldApplyViewportUpdate(opened, jittered),
  false,
  '同一开合状态内小于步长的高度抖动必须忽略',
);

const settled = computeViewportMetrics({
  viewportHeight: 508 + VIEWPORT_STABLE_DELTA,
  viewportOffsetTop: 0,
  layoutHeight: 844,
});
assert.equal(
  shouldApplyViewportUpdate(opened, settled),
  true,
  '超过步长的变化必须采纳',
);

// 首帧（初始 height 为 0）无条件采纳，保证首屏就能拿到真实视口。
assert.equal(
  shouldApplyViewportUpdate(FALLBACK_VIEWPORT_METRICS, closed),
  true,
  '初始状态必须采纳第一次采样',
);

console.log('keyboard inset contract passed');
