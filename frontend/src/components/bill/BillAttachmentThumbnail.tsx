'use client';

import * as React from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import type { TransactionAttachmentSummary } from '@/lib/api/attachment-types';
import { getAttachmentAccessUrl } from '@/lib/api/attachment-api';
import {
  attachmentCacheKey,
  readAttachmentBlob,
  saveAttachmentBlob,
  saveAttachmentSummary,
} from '@/lib/offline/storage';

export interface BillAttachmentThumbnailProps {
  ledgerId: string;
  userId: string | null;
  attachment: TransactionAttachmentSummary;
}

/** 账单列表只加载首张附件缩略图，避免首屏拉取每张原图。 */
export function BillAttachmentThumbnail({
  ledgerId,
  userId,
  attachment,
}: BillAttachmentThumbnailProps): React.JSX.Element {
  const [url, setUrl] = React.useState<string | null>(attachment.accessUrl ?? null);
  const [failed, setFailed] = React.useState(false);
  const objectUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (attachment.accessUrl) return;

      if (userId) {
        const cachedBlob = await readAttachmentBlob(userId, ledgerId, attachment.id).catch(() => null);
        if (cachedBlob) {
          const objectUrl = URL.createObjectURL(cachedBlob);
          objectUrlRef.current = objectUrl;
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
          } else {
            setUrl(objectUrl);
          }
          return;
        }
      }

      const result = await getAttachmentAccessUrl(ledgerId, attachment.id);
      if (!userId) {
        if (!cancelled) setUrl(result.accessUrl);
        return;
      }

      const response = await fetch(result.accessUrl, { credentials: 'omit' }).catch(() => null);
      if (!response?.ok) {
        if (!cancelled) setUrl(result.accessUrl);
        return;
      }

      const blob = await response.blob();
      const now = new Date().toISOString();
      const cacheKey = attachmentCacheKey(userId, ledgerId, attachment.id);
      await saveAttachmentSummary({
        cacheKey,
        userId,
        ledgerId,
        attachmentId: attachment.id,
        transactionId: attachment.transactionId,
        status: attachment.status,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        originalName: attachment.originalName,
        cachedAt: now,
        lastAccessedAt: now,
        cacheState: 'CACHED',
        createdAt: attachment.createdAt,
      }).catch(() => undefined);
      await saveAttachmentBlob({
        cacheKey,
        userId,
        ledgerId,
        attachmentId: attachment.id,
        blob,
        mimeType: attachment.mimeType,
        sizeBytes: blob.size,
        lastAccessedAt: now,
        createdAt: now,
      }).catch(() => undefined);

      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
      } else {
        setUrl(objectUrl);
      }
    };

    void load().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [
    attachment.accessUrl,
    attachment.createdAt,
    attachment.id,
    attachment.mimeType,
    attachment.originalName,
    attachment.sizeBytes,
    attachment.status,
    attachment.transactionId,
    ledgerId,
    userId,
  ]);

  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-card-subtle text-text-muted"
      aria-label={`${attachment.originalName ?? '图片附件'}缩略图`}
    >
      {failed ? (
        <ImageOff size={15} />
      ) : url ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Loader2 size={15} className="animate-spin" />
      )}
    </span>
  );
}
