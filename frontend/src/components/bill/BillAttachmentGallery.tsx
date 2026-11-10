'use client';

import * as React from 'react';
import { ImageOff, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import type { TransactionAttachmentSummary } from '@/lib/api/attachment-types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { attachmentIdsNeedingUrl } from '@/lib/bill/bill-attachments';

export interface BillAttachmentGalleryProps {
  attachments: readonly TransactionAttachmentSummary[];
  canDelete: boolean;
  deletingId: string | null;
  onDelete: (attachment: TransactionAttachmentSummary) => void;
  onRefreshUrl: (attachmentId: string) => Promise<string>;
}

export function BillAttachmentGallery({
  attachments,
  canDelete,
  deletingId,
  onDelete,
  onRefreshUrl,
}: BillAttachmentGalleryProps): React.JSX.Element | null {
  const [viewer, setViewer] = React.useState<TransactionAttachmentSummary | null>(null);
  const [viewerUrl, setViewerUrl] = React.useState<string | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [failedIds, setFailedIds] = React.useState<Set<string>>(() => new Set());
  const [resolvedUrls, setResolvedUrls] = React.useState<Record<string, string>>({});
  const autoRefreshAttemptedIds = React.useRef<Set<string>>(new Set());
  const loadingPreviewIds = React.useRef<Set<string>>(new Set());
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    const pendingIds = attachmentIdsNeedingUrl(attachments, new Set(Object.keys(resolvedUrls)));
    for (const attachmentId of pendingIds) {
      if (loadingPreviewIds.current.has(attachmentId)) continue;
      loadingPreviewIds.current.add(attachmentId);
      void onRefreshUrl(attachmentId)
        .then((url) => {
          if (!mountedRef.current) return;
          setResolvedUrls((current) => ({ ...current, [attachmentId]: url }));
          setFailedIds((current) => {
            const next = new Set(current);
            next.delete(attachmentId);
            return next;
          });
        })
        .catch(() => undefined)
        .finally(() => loadingPreviewIds.current.delete(attachmentId));
    }

    return () => {
      mountedRef.current = false;
    };
  }, [attachments, onRefreshUrl, resolvedUrls]);

  if (attachments.length === 0) return null;

  const openViewer = async (attachment: TransactionAttachmentSummary): Promise<void> => {
    setViewer(attachment);
    setViewerUrl(null);
    setLoadingId(attachment.id);
    try {
      const url = await onRefreshUrl(attachment.id);
      setResolvedUrls((current) => ({ ...current, [attachment.id]: url }));
      setViewerUrl(url);
    } catch {
      setViewerUrl(null);
    } finally {
      setLoadingId(null);
    }
  };

  const refreshViewer = async (): Promise<void> => {
    if (!viewer) return;
    autoRefreshAttemptedIds.current.delete(viewer.id);
    setLoadingId(viewer.id);
    try {
      const url = await onRefreshUrl(viewer.id);
      setResolvedUrls((current) => ({ ...current, [viewer.id]: url }));
      setViewerUrl(url);
      setFailedIds((current) => {
        const next = new Set(current);
        next.delete(viewer.id);
        return next;
      });
    } catch {
      setViewerUrl(null);
    } finally {
      setLoadingId(null);
    }
  };

  const handleImageError = (attachmentId: string): void => {
    setFailedIds((current) => new Set(current).add(attachmentId));
    if (autoRefreshAttemptedIds.current.has(attachmentId)) return;
    autoRefreshAttemptedIds.current.add(attachmentId);
    void onRefreshUrl(attachmentId).then((url) => {
      setResolvedUrls((current) => ({ ...current, [attachmentId]: url }));
      setFailedIds((current) => {
        const next = new Set(current);
        next.delete(attachmentId);
        return next;
      });
      if (viewer?.id === attachmentId) setViewerUrl(url);
    }).catch(() => undefined);
  };

  return (
    <>
      <section className="mb-4">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3 className="text-[11px] font-semibold text-text-tertiary">图片附件</h3>
          <span className="text-[10px] text-text-muted">{attachments.length} 张</span>
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-app-border bg-app-card p-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative aspect-square overflow-hidden rounded-xl bg-app-card-subtle">
              <button
                type="button"
                onClick={() => void openViewer(attachment)}
                className="size-full"
                aria-label={`查看${attachment.originalName ?? '图片附件'}`}
              >
                {(resolvedUrls[attachment.id] ?? attachment.accessUrl) && !failedIds.has(attachment.id) ? (
                  <img
                    src={resolvedUrls[attachment.id] ?? attachment.accessUrl}
                    alt={attachment.originalName ?? '账单图片'}
                    className="size-full object-cover"
                    onError={() => handleImageError(attachment.id)}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-text-muted">
                    <ImageOff size={18} />
                  </span>
                )}
              </button>
              {canDelete && (
                <button
                  type="button"
                  aria-label={`删除${attachment.originalName ?? '图片附件'}`}
                  onClick={() => onDelete(attachment)}
                  disabled={deletingId === attachment.id}
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                >
                  {deletingId === attachment.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <BottomSheet
        open={viewer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewer(null);
            setViewerUrl(null);
          }
        }}
        layer="nested"
        variant="full"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-black">
          <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
            <span className="min-w-0 truncate text-xs">{viewer?.originalName ?? '图片附件'}</span>
            <button
              type="button"
              aria-label="关闭图片预览"
              onClick={() => setViewer(null)}
              className="flex size-8 items-center justify-center rounded-full bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center p-4"
            onErrorCapture={() => {
              if (viewer) handleImageError(viewer.id);
            }}
          >
            {loadingId === viewer?.id && <Loader2 size={28} className="animate-spin text-white" />}
            {loadingId !== viewer?.id && viewerUrl && (
              <img src={viewerUrl} alt={viewer?.originalName ?? '图片附件'} className="max-h-full max-w-full object-contain" />
            )}
            {loadingId !== viewer?.id && !viewerUrl && (
              <div className="text-center text-sm text-white/80">
                <ImageOff className="mx-auto mb-2" size={28} />
                <p>图片暂时无法加载</p>
                <button type="button" onClick={() => void refreshViewer()} className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs">
                  <RotateCw size={12} />
                  重新加载
                </button>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
