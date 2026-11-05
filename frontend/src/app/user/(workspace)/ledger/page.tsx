import { redirect } from 'next/navigation';

/**
 * 二期把「我的账本」迁到 `/user/ledgers`（二级页）。
 *
 * 旧路径继续保留并重定向，避免书签、历史通知和外部链接失效。
 */
export default function LegacyLedgerListPage(): never {
  redirect('/user/ledgers');
}
