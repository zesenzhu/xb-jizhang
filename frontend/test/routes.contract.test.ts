import assert from 'node:assert/strict';
import {
  getDefaultRoute,
  getLoginRoute,
  isAdminRoute,
  isUserRoute,
  shouldProtectRoute,
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
assert.equal(shouldProtectRoute('/user'), true);
assert.equal(shouldProtectRoute('/user/login'), false);
assert.equal(shouldProtectRoute('/user/register'), false);
assert.equal(shouldProtectRoute('/admin'), true);
assert.equal(shouldProtectRoute('/admin/login'), false);

console.log('route contract passed');
