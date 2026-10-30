import { redirect } from 'next/navigation';
import { getSafeRedirectTarget } from '@/lib/routing/routes';

export default async function LoginCompatibilityPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ redirect?: string }> }>): Promise<never> {
  const params = await searchParams;
  const target = getSafeRedirectTarget(params.redirect, 'user');
  redirect(`/user/login?redirect=${encodeURIComponent(target)}`);
}
