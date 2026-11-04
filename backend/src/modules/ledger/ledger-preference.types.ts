import type { LedgerMemberRole, LedgerType } from '@prisma/client';

export interface UpdateLedgerPreferencesInput {
  currentLedgerId?: string;
  defaultLedgerId?: string;
}

export interface LedgerPreferenceLedgerSummary {
  id: string;
  name: string;
  type: LedgerType;
  defaultCurrency: string;
  timezone: string;
  memberRole: LedgerMemberRole;
}

export interface LedgerPreferencesResult {
  currentLedgerId: string | null;
  defaultLedgerId: string | null;
  currentLedger: LedgerPreferenceLedgerSummary | null;
  defaultLedger: LedgerPreferenceLedgerSummary | null;
  updatedAt: Date;
}
