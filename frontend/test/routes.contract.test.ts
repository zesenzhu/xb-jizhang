import assert from 'node:assert/strict';
import {
  getDefaultRoute,
  getLoginRoute,
  getLoginRedirectUrl,
  getSafeRedirectTarget,
  isAdminRoute,
  isUserRoute,
  shouldProtectRoute,
  isUserPrimaryTabRoute,
  getUserPrimaryTab,
} from '../src/lib/routing/routes';

assert.equal(isUserRoute('/user'), true);
assert.equal(isUserRoute('/user/ledger/ledger-1'), true);
assert.equal(isUserRoute('/admin'), false);
assert.equal(isAdminRoute('/admin'), true);
assert.equal(isAdminRoute('/admin/users'), true);
assert.equal(isAdminRoute('/user'), false);
assert.equal(getLoginRoute('user'), '/user/login');
assert.equal(getLoginRoute('admin'), '/admin/login');
assert.equal(getDefaultRoute('user'), '/user');
assert.equal(getDefaultRoute('admin'), '/admin');
assert.equal(getSafeRedirectTarget('/user/ledger/ledger-1', 'user'), '/user/ledger/ledger-1');
assert.equal(getSafeRedirectTarget('https://example.com', 'user'), '/user');
assert.equal(getSafeRedirectTarget('/user/../admin', 'user'), '/user');
assert.equal(getSafeRedirectTarget('/user\\\\admin', 'user'), '/user');
assert.equal(getSafeRedirectTarget('/admin', 'user'), '/user');
assert.equal(getSafeRedirectTarget('/admin/users', 'admin'), '/admin/users');
assert.equal(getSafeRedirectTarget('/user', 'admin'), '/admin');
assert.equal(
  getLoginRedirectUrl('user', '/user/ledger/ledger-1'),
  '/user/login?redirect=%2Fuser%2Fledger%2Fledger-1',
);
assert.equal(getLoginRedirectUrl('admin', '/admin/users'), '/admin/login?redirect=%2Fadmin%2Fusers');
assert.equal(shouldProtectRoute('/user'), true);
assert.equal(shouldProtectRoute('/user/login'), false);
assert.equal(shouldProtectRoute('/user/register'), false);
assert.equal(shouldProtectRoute('/admin'), true);
assert.equal(shouldProtectRoute('/admin/login'), false);

// 一级 Tab 路由判定与映射断言（一级页面常驻底栏，二级页面自动隐藏）
assert.equal(isUserPrimaryTabRoute('/user'), true);
assert.equal(isUserPrimaryTabRoute('/user/'), true);
assert.equal(isUserPrimaryTabRoute('/user/statistics'), true);
assert.equal(isUserPrimaryTabRoute('/user/statistics/'), true);
assert.equal(isUserPrimaryTabRoute('/user/profile'), true);
assert.equal(isUserPrimaryTabRoute('/user/profile/'), true);

// 二期底栏只有账本、统计、我的三项
assert.equal(getUserPrimaryTab('/user'), 'ledger');
assert.equal(getUserPrimaryTab('/user/statistics'), 'statistics');
assert.equal(getUserPrimaryTab('/user/profile'), 'profile');
// 旧的独立账本列表不再是主导航项
assert.equal(getUserPrimaryTab('/user/ledger'), null);

// 二级或深层子页面不得判定为一级 Tab
assert.equal(isUserPrimaryTabRoute('/user/ledger/new'), false);
assert.equal(isUserPrimaryTabRoute('/user/ledger/abc-123'), false);
assert.equal(isUserPrimaryTabRoute('/user/ledgers'), false);
assert.equal(isUserPrimaryTabRoute('/user/ledgers/abc/settings'), false);
assert.equal(isUserPrimaryTabRoute('/user/login'), false);
assert.equal(isUserPrimaryTabRoute('/user/register'), false);
assert.equal(getUserPrimaryTab('/user/ledger/new'), null);

console.log('route contract passed');
