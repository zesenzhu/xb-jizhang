'use client';

import * as React from 'react';
import { ImagePlus, Loader2, RotateCw, X } from 'lucide-react';
import type { AttachmentDraft } from '@/lib/api/attachment-types';
import { ATTACHMENT_MAX_COUNT } from '@/lib/bill/attachment-validation';

export interface AttachmentPickerProps {
  drafts: readonly AttachmentDraft[];
  /** 编辑账单时服务端已经存在的附件数量，参与单笔 5 张上限。 */
  existingAttachmentCount?: number;
  onOpen: () => void;
  onRemove: (localId: string) => void;
  onRetry?: () => void;
  disabled?: boolean;
}

export function AttachmentPicker({
  drafts,
  existingAttachmentCount = 0,
  onOpen,
  onRemove,
  onRetry,
  disabled = false,
}: AttachmentPickerProps): React.JSX.Element | null {
  if (drafts.length === 0) return null;

  const totalCount = existingAttachmentCount + drafts.length;

  return (
    <section className="mx-3 mb-2 rounded-2xl border border-app-border bg-app-card-subtle/70 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text-main">待上传图片</p>
          <p className="mt-0.5 text-[10px] text-text-muted">
            {existingAttachmentCount > 0
              ? `已有 ${existingAttachmentCount} 张，新增图片保存后上传`
              : `保存账单后上传，最多 ${ATTACHMENT_MAX_COUNT} 张`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {drafts.some((draft) => draft.status === 'FAILED') && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full border border-amber-300 px-2.5 py-1 text-[11px] text-amber-700 disabled:opacity-50"
            >
              <RotateCw size={12} />
              重试
            </button>
          )}
          {totalCount < ATTACHMENT_MAX_COUNT && (
            <button
              type="button"
              onClick={onOpen}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full border border-app-border px-2.5 py-1 text-[11px] text-text-main disabled:opacity-50"
            >
              <ImagePlus size={13} />
              添加
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {drafts.map((draft) => (
          <div key={draft.localId} className="relative aspect-square overflow-hidden rounded-xl border border-app-border bg-app-card">
            <img src={draft.previewUrl} alt={draft.file.name} className="size-full object-cover" />
            {draft.status === 'UPLOADING' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {draft.status === 'FAILED' && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-rose-600/90 px-1 py-1 text-[9px] text-white">
                <RotateCw size={10} />
                失败，可重试
              </div>
            )}
            {draft.status !== 'UPLOADING' && (
              <button
                type="button"
                aria-label={`移除${draft.file.name}`}
                onClick={() => onRemove(draft.localId)}
                disabled={disabled}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
