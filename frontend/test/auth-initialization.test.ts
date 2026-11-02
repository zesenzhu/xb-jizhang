import assert from 'node:assert/strict';
import { initializeAuthSession } from '../src/lib/auth/initialize-auth';

void (async () => {
  const successEvents: string[] = [];
  await initializeAuthSession({
    load: async () => 'user-1',
    isActive: () => true,
    onAuthenticated: (value) => successEvents.push(`authenticated:${value}`),
    onUnauthenticated: () => successEvents.push('unauthenticated'),
  });
  assert.deepEqual(successEvents, ['authenticated:user-1']);

  const failureEvents: string[] = [];
  await initializeAuthSession({
    load: async () => {
      throw new Error('会话已失效');
    },
    isActive: () => true,
    onAuthenticated: (value: string) => failureEvents.push(`authenticated:${value}`),
    onUnauthenticated: () => failureEvents.push('unauthenticated'),
  });
  assert.deepEqual(failureEvents, ['unauthenticated']);

  let active = false;
  const inactiveEvents: string[] = [];
  await initializeAuthSession({
    load: async () => 'user-2',
    isActive: () => active,
    onAuthenticated: (value) => inactiveEvents.push(`authenticated:${value}`),
    onUnauthenticated: () => inactiveEvents.push('unauthenticated'),
  });
  assert.deepEqual(inactiveEvents, []);

  console.log('auth initialization contract passed');
})();
