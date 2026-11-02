import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const workspaceRoot = new URL('../src/app/user/(workspace)/', import.meta.url);
const workspaceProfile = new URL('./profile/page.tsx', workspaceRoot);
const legacyProfile = new URL('../profile/page.tsx', workspaceRoot);

assert.equal(existsSync(workspaceProfile), true);
assert.equal(existsSync(legacyProfile), false);

console.log('workspace layout contract passed');
