import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration';
import { QueryProvider } from '@/components/providers/QueryProvider';

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
  // iOS 在聚焦字号小于 16px 的控件时会自动放大页面；用 maximum-scale 关掉这次自动缩放，
  // 字号保持设计值，不为了规避系统行为去改视觉。用户双指缩放仍由系统决定。
  maximumScale: 1,
  // 键盘弹出时让 visualViewport 收缩，而不是把整个页面放大。
  interactiveWidget: 'resizes-visual',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="zh-CN">
      <body>
        <ServiceWorkerRegistration />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
