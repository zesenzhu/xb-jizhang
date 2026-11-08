import assert from 'node:assert/strict';
import { billCreatorName } from '../src/lib/bill/bill-creator';

assert.equal(billCreatorName({ createdBy: { id: 'u1', username: 'xiaobao', nickname: '小宝', avatar: null } }), '小宝');
assert.equal(billCreatorName({ createdBy: { id: 'u1', username: 'xiaobao', nickname: '  ', avatar: null } }), 'xiaobao');
assert.equal(billCreatorName({ createdBy: null }), '');
assert.equal(billCreatorName({}), '');

console.log('bill creator contract passed');
