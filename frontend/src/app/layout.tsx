import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration';

export const metadata: Metadata = {
  title: '小宝记账',
  description: '个人与多人共享账本 PWA',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="zh-CN">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
