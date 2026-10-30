export default async function UserLedgerPage({
  params,
}: Readonly<{ params: Promise<{ ledgerId: string }> }>): Promise<React.JSX.Element> {
  const { ledgerId } = await params;
  return (
    <main>
      <h1>账本工作区</h1>
      <p>当前账本：{ledgerId}</p>
    </main>
  );
}
