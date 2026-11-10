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
        !attachment.accessUrl &&
        !resolvedIds.has(attachment.id),
    )
    .map((attachment) => attachment.id);
}

/** 列表缩略图只使用第一张已完成附件。 */
export function firstAttachedAttachment(
  attachments: readonly TransactionAttachmentSummary[] | undefined,
): TransactionAttachmentSummary | undefined {
  return attachments?.find((attachment) => attachment.status === 'ATTACHED');
}
