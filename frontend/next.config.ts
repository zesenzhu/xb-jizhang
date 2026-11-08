import type { NextConfig } from 'next';

/**
 * 本地前端连生产接口时走同源代理。
 *
 * 生产 Cookie 是 `SameSite=Lax`，浏览器从 `localhost:8090` 直连
 * `https://jizhang.xiaobao.work/api` 属于跨站请求，登录态不会被带上。
 * 因此由 Next 开发服务器把 `/api/*` 转发到生产域名，浏览器始终认为自己在同源请求。
 */
const apiProxyTarget = process.env.DEV_API_PROXY_TARGET?.trim();

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
