import { redirect } from 'next/navigation';

/** 旧的「新建账本」独立页并入「我的账本」的创建面板。 */
export default function LegacyNewLedgerPage(): never {
  redirect('/user/ledgers?create=1');
}
