/* The two apps have to agree on what a saved value is called, or an account silently
   carries half of it. They are in different languages and neither can import the other,
   so the agreement is checked here, against the source of both.
       node test-sync.mjs                                                            */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const web = readFileSync('play/account.mjs', 'utf8');
const app = readFileSync('ios/MahjongGPT/Engine/Account.swift', 'utf8');

/* const CARRIED = ['a', 'b', 'c']; */
const carried = [...web.match(/const CARRIED = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)]
  .map(m => m[1]);
/* var remote: String { switch self { case .table: "x" ... } } */
const remote = [...app.match(/var remote: String \{[\s\S]*?\n    \}/)[0]
  .matchAll(/case \.(\w+): "([^"]+)"/g)].reduce((all, m) => ({ ...all, [m[1]]: m[2] }), {});

assert.equal(carried.length, 3, 'the web carries three keys');
assert.equal(Object.keys(remote).length, 3, 'the app carries three keys');

/* The school and the sound are the same value on both, so they travel under one name and
   do cross between a browser and a phone. */
for (const shared of [remote.school, remote.sound]) {
  assert.ok(carried.includes(shared), `the web does not carry ${shared}, so it cannot cross`);
}

/* The table is shaped differently in each, so it must NOT share a name -- a phone reading
   a browser's table would decode a record that is missing a field and keep nothing. */
assert.ok(!carried.includes(remote.table),
  `the app's table key ${remote.table} is also the web's: the two shapes would collide`);
assert.ok(remote.table.startsWith(carried.find(k => k.startsWith('mahjong-table'))),
  'the app\'s table key should be the web\'s with a suffix, so the pair reads as a pair');

console.log('sync keys agree:', carried.join(', '), '| app table:', remote.table);
