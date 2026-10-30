import assert from 'node:assert/strict';
import { shouldSkipAuthRefresh } from '../src/lib/api/client';
import { createRefreshQueue } from '../src/lib/api/refresh-queue';
import { adminClient, ADMIN_REFRESH_PATH } from '../src/lib/api/admin-client';
import { userClient, USER_REFRESH_PATH } from '../src/lib/api/user-client';

assert.equal(userClient.defaults.withCredentials, true);
assert.equal(adminClient.defaults.withCredentials, true);
assert.equal(USER_REFRESH_PATH, '/auth/refresh');
assert.equal(ADMIN_REFRESH_PATH, '/admin/auth/refresh');
assert.equal(shouldSkipAuthRefresh('/auth/login', ['/auth/login']), true);
assert.equal(shouldSkipAuthRefresh('/auth/login?from=expired', ['/auth/login']), true);
assert.equal(shouldSkipAuthRefresh('/users/me', ['/auth/login']), false);

void (async () => {
  const queue = createRefreshQueue();
  let refreshCount = 0;
  const refresh = (): Promise<void> => {
    refreshCount += 1;
    return new Promise((resolve) => setTimeout(resolve, 5));
  };

  await Promise.all([queue.run(refresh), queue.run(refresh), queue.run(refresh)]);
  assert.equal(refreshCount, 1);

  console.log('api client contract passed');
})();
