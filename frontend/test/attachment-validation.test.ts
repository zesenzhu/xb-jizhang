import assert from 'node:assert/strict';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  validateAttachmentFile,
  validateAttachmentFiles,
} from '../src/lib/bill/attachment-validation';

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

assert.equal(validateAttachmentFile(file('receipt.jpg', 'image/jpeg', 100)), null);
assert.equal(validateAttachmentFile(file('receipt.png', 'image/png', 100)), null);
assert.equal(validateAttachmentFile(file('receipt.webp', 'image/webp', 100)), null);
assert.equal(validateAttachmentFile(file('receipt.gif', 'image/gif', 100)), '仅支持 JPEG、PNG 或 WebP 图片');
assert.equal(validateAttachmentFile(file('empty.jpg', 'image/jpeg', 0)), '图片内容为空，无法上传');
assert.equal(
  validateAttachmentFile(file('large.jpg', 'image/jpeg', ATTACHMENT_MAX_BYTES + 1)),
  '单张图片不能超过 10 MB',
);

const fiveFiles = Array.from({ length: ATTACHMENT_MAX_COUNT }, (_, index) =>
  file(`receipt-${index}.jpg`, 'image/jpeg', 100),
);
const accepted = validateAttachmentFiles(fiveFiles);
assert.equal(accepted.accepted.length, ATTACHMENT_MAX_COUNT);
assert.deepEqual(accepted.errors, []);

const overLimit = validateAttachmentFiles(
  [file('four.jpg', 'image/jpeg', 100), file('five.jpg', 'image/jpeg', 100)],
  4,
);
assert.equal(overLimit.accepted.length, 1);
assert.deepEqual(overLimit.errors, ['单笔账单最多添加 5 张图片']);

const invalid = validateAttachmentFiles([file('bad.gif', 'image/gif', 100)]);
assert.deepEqual(invalid.accepted, []);
assert.deepEqual(invalid.errors, ['bad.gif：仅支持 JPEG、PNG 或 WebP 图片']);

console.log('attachment validation passed');
