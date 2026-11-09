import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  LedgerPreferenceLedgerSummary,
  LedgerPreferencesResult,
  UpdateLedgerPreferencesInput,
} from './ledger-preference.types';

const ledgerSelect = {
  id: true,
  name: true,
  type: true,
  defaultCurrency: true,
  timezone: true,
} as const;

const preferenceSelect = {
  currentLedgerId: true,
  defaultLedgerId: true,
  updatedAt: true,
} as const;

const membershipSelect = {
  ledgerId: true,
  role: true,
  ledger: { select: ledgerSelect },
} as const;

type PreferenceClient = Pick<
  Prisma.TransactionClient,
  'ledgerMember' | 'userLedgerPreference'
>;
type PreferenceMembership = Prisma.LedgerMemberGetPayload<{ select: typeof membershipSelect }>;

@Injectable()
export class LedgerPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<LedgerPreferencesResult> {
    return this.resolve(userId, this.prisma);
  }

  async update(
    userId: string,
    input: UpdateLedgerPreferencesInput,
  ): Promise<LedgerPreferencesResult> {
    if (input.currentLedgerId === undefined && input.defaultLedgerId === undefined) {
      throw this.invalidInputException();
    }

    return this.prisma.$transaction((transaction) =>
      this.resolve(userId, transaction, input, true),
    );
  }

  private async resolve(
    userId: string,
    client: PreferenceClient,
    requested: UpdateLedgerPreferencesInput = {},
    persist = false,
  ): Promise<LedgerPreferencesResult> {
    const preference = await client.userLedgerPreference.findUnique({
      where: { userId },
      select: preferenceSelect,
    });
    const candidateIds = [
      requested.currentLedgerId,
      requested.defaultLedgerId,
      preference?.currentLedgerId,
      preference?.defaultLedgerId,
    ].filter((id): id is string => id !== undefined && id !== null);
    const uniqueCandidateIds = [...new Set(candidateIds)];
    const memberships = uniqueCandidateIds.length
      ? await client.ledgerMember.findMany({
          where: {
            userId,
            status: 'ACTIVE',
            ledgerId: { in: uniqueCandidateIds },
          },
          select: membershipSelect,
        })
      : [];
    const membershipByLedgerId = new Map(memberships.map((membership) => [membership.ledgerId, membership]));

    for (const requestedId of [requested.currentLedgerId, requested.defaultLedgerId]) {
      if (requestedId !== undefined && !membershipByLedgerId.has(requestedId)) {
        throw this.notFoundException();
      }
    }

    const fallback = await client.ledgerMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ joinedAt: 'asc' }, { ledgerId: 'asc' }],
      select: membershipSelect,
    });
    const currentMembership = this.resolveMembership(
      requested.currentLedgerId ?? preference?.currentLedgerId,
      membershipByLedgerId,
      fallback,
    );
    const defaultMembership = this.resolveMembership(
      requested.defaultLedgerId ?? preference?.defaultLedgerId,
      membershipByLedgerId,
      fallback,
    );
    const currentLedgerId = currentMembership?.ledgerId ?? null;
    const defaultLedgerId = defaultMembership?.ledgerId ?? null;
    const changed =
      preference === null ||
      preference.currentLedgerId !== currentLedgerId ||
      preference.defaultLedgerId !== defaultLedgerId;
    const persisted =
      persist && changed
        ? await client.userLedgerPreference.upsert({
            where: { userId },
            create: { userId, currentLedgerId, defaultLedgerId },
            update: { currentLedgerId, defaultLedgerId },
            select: { updatedAt: true },
          })
        : null;

    return {
      currentLedgerId,
      defaultLedgerId,
      currentLedger: this.toLedgerSummary(currentMembership),
      defaultLedger: this.toLedgerSummary(defaultMembership),
      updatedAt: persisted?.updatedAt ?? preference?.updatedAt ?? new Date(),
    };
  }

  private resolveMembership(
    requestedId: string | null | undefined,
    membershipByLedgerId: Map<string, PreferenceMembership>,
    fallback: PreferenceMembership | null,
  ): PreferenceMembership | null {
    return (requestedId ? membershipByLedgerId.get(requestedId) : undefined) ?? fallback;
  }

  private toLedgerSummary(
    membership: PreferenceMembership | null,
  ): LedgerPreferenceLedgerSummary | null {
    if (!membership) return null;
    return { ...membership.ledger, memberRole: membership.role };
  }

  private invalidInputException(): BadRequestException {
    return new BadRequestException({ code: 40001, message: '至少需要设置一个账本偏好', data: null });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40401, message: '账本资源不存在', data: null });
  }
}
