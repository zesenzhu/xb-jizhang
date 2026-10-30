export default function UserLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <section data-application="user">{children}</section>;
}
