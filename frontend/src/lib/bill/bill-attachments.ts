import type { TransactionAttachmentSummary } from '@/lib/api/attachment-types';

/** 详情打开时需要先取得签名地址的已完成附件。 */
export function attachmentIdsNeedingUrl(
  attachments: readonly TransactionAttachmentSummary[],
  resolvedIds: ReadonlySet<string> = new Set(),
): string[] {
  return attachments
    .filter(
      (attachment) =>
        attachment.status === 'ATTACHED' &&
        !isUsableAccessUrl(attachment) &&
        !resolvedIds.has(attachment.id),
    )
    .map((attachment) => attachment.id);
}

/**
 * 签名地址只能在有效期内复用；blob URL 属于上一次详情渲染，移动端面板卸载后不能继续信任。
 */
function isUsableAccessUrl(attachment: TransactionAttachmentSummary): boolean {
  const accessUrl = attachment.accessUrl;
  if (!accessUrl || accessUrl.startsWith('blob:')) return false;
  if (!attachment.accessUrlExpiresAt) return true;

  const expiresAt = Date.parse(attachment.accessUrlExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 30_000;
}

/** 列表缩略图只使用第一张已完成附件。 */
export function firstAttachedAttachment(
  attachments: readonly TransactionAttachmentSummary[] | undefined,
): TransactionAttachmentSummary | undefined {
  return attachments?.find((attachment) => attachment.status === 'ATTACHED');
}
