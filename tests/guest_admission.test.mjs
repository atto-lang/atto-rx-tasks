// Source-free test of the exact-compiler admission preflight, not guest runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/test_guest.mjs');
function run(extra) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, ORES_CLASSPATH: 'unverified-fake-classes', ...extra }
  });
}
test('guest compiler runner denies missing immutable compiler identity', () => {
  const result = run({});
  assert.equal(result.status, 2);
  assert.match(result.stderr, /NOT_EXECUTED: require ORES_COMPILER_REPO/);
  assert.doesNotMatch(result.stdout, /PASS guest/);
});
test('guest compiler runner denies invalid source SHA before Java starts', () => {
  const result = run({
    ORES_COMPILER_REPO: '/unused',
    ORES_COMPILER_SHA: 'untrusted',
    ORES_COMPILER_TREE_SHA: '0'.repeat(40)
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /NOT_EXECUTED/);
});
test('guest compiler runner denies nonexistent compiler checkout', () => {
  const result = run({
    ORES_COMPILER_REPO: '/does-not-exist-oreslang-task-compiler',
    ORES_COMPILER_SHA: '1'.repeat(40),
    ORES_COMPILER_TREE_SHA: '2'.repeat(40)
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /NOT_EXECUTED: compiler checkout path/);
});
