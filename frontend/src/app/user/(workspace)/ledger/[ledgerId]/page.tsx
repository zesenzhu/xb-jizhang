import { redirect } from 'next/navigation';

interface LegacyLedgerDetailPageProps {
  params: Promise<{ ledgerId: string }>;
}

/** 旧的账本详情页由账本设置页接管；保留路径以免已有链接失效。 */
export default async function LegacyLedgerDetailPage({
  params,
}: LegacyLedgerDetailPageProps): Promise<never> {
  const { ledgerId } = await params;
  redirect(`/user/ledgers/${encodeURIComponent(ledgerId)}/settings`);
}
