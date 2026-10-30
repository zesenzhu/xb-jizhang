export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <section data-application="admin">{children}</section>;
}
