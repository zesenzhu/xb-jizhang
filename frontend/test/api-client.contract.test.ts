import assert from 'node:assert/strict';
import { createRefreshQueue } from '../src/lib/api/refresh-queue';
import { adminClient, ADMIN_REFRESH_PATH } from '../src/lib/api/admin-client';
import { userClient, USER_REFRESH_PATH } from '../src/lib/api/user-client';

assert.equal(userClient.defaults.withCredentials, true);
assert.equal(adminClient.defaults.withCredentials, true);
assert.equal(USER_REFRESH_PATH, '/auth/refresh');
assert.equal(ADMIN_REFRESH_PATH, '/admin/auth/refresh');

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
