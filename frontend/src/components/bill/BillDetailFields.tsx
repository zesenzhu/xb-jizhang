'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { BillDetailField, BillDetailView } from '@/lib/bill/bill-detail';

export interface BillDetailFieldsProps {
  view: BillDetailView;
  /** 编辑态：字段区被表单替换，只保留审计区 */
  showFacts?: boolean;
}

/**
 * 详情只读字段。
 *
 * 空字段在 `toBillDetailView` 阶段已被剔除，这里不做二次判空，
 * 因此不会出现「备注 —」这类占位行。
 */
export function BillDetailFields({ view, showFacts = true }: BillDetailFieldsProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {showFacts && view.facts.length > 0 && <FieldGroup title="账单信息" fields={view.facts} />}
      <FieldGroup title="记录信息" fields={view.audit} muted />
    </div>
  );
}

function FieldGroup({
  title,
  fields,
  muted = false,
}: {
  title: string;
  fields: readonly BillDetailField[];
  muted?: boolean;
}): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold text-text-tertiary">{title}</h3>
      <dl className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border bg-app-card">
        {fields.map((field) => (
          <div key={field.key} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <dt className="shrink-0 text-xs text-text-muted">{field.label}</dt>
            <dd
              className={cn(
                'min-w-0 break-words text-right text-xs',
                muted ? 'text-text-muted' : 'text-text-main',
              )}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
