// Static candidate admission checks. Source-only: not a compiler or runtime test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/task_subscription.ores'), 'utf8');
const code = source.replace(/\/\/[^\n]*/g, '');

test('stage-1 source keeps native Task substrate without Channel/Future adapters', () => {
  assert.match(code, /TaskSubscription<T>/);
  assert.match(code, /let Task<T> producer;/);
  assert.doesNotMatch(code, /val Task<T> producer;/);
  assert.match(code, /next_task\(mut self\)\(\): Option<Task<TaskStreamEvent<T>>>/);
  assert.doesNotMatch(code, /\bChannel\s*</);
  assert.doesNotMatch(code, /\bFuture\s*</);
});

test('stage-1 source moves the producer into exactly one child after a demand claim', () => {
  assert.match(code, /if self\.cancelled \|\| self\.demand_claimed/);
  assert.match(code, /self\.demand_claimed = true;/);
  assert.equal((code.match(/rt take self\.producer/g) || []).length, 1);
  assert.equal((code.match(/= task \{/g) || []).length, 1);
  assert.match(code, /await one_producer;/);
  const childBody = code.match(/val Task<TaskStreamEvent<T>> child = task \{([\s\S]*?)\n    \};/)?.[1];
  assert.ok(childBody, 'must have an admitted observer Task body');
  assert.doesNotMatch(childBody, /\bself\./);
});

test('stage-1 cancellation refuses post-demand claims and never revokes external producer', () => {
  const cancelMethod = code.match(/pub cancel\(mut self\)\(\): bool \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(cancelMethod);
  assert.match(cancelMethod, /if self\.cancelled \|\| self\.demand_claimed/);
  assert.match(cancelMethod, /return false;/);
  assert.doesNotMatch(code, /\.cancel\(\)/);
});

test('stage-1 fixture is gated and possesses an exact expected-output oracle', () => {
  const runner = readFileSync(resolve(root, 'scripts/test_guest.mjs'), 'utf8');
  assert.match(runner, /ORES_TEST_STAGE1 === '1'/);
  assert.match(runner, /tests\/task_subscription\.out/);
  assert.equal(readFileSync(resolve(root, 'tests/task_subscription.out'), 'utf8'),
    'true\n42\ntrue\nfalse\ntrue\nfalse\ntrue\n');
});

test('stage-1 runner includes a runtime-negative oracle for double Task field extraction', () => {
  const runner = readFileSync(resolve(root, 'scripts/test_guest.mjs'), 'utf8');
  const bad = readFileSync(resolve(root, 'tests/negative/double_field_take.ores'), 'utf8');
  assert.match(runner, /filename: 'double_field_take.ores'/);
  assert.match(runner, /reason: \/already moved\//);
  assert.match(runner, /'--check', file/);
  assert.match(runner, /compiled.status !== 0/);
  assert.match(runner, /NOT_EXECUTED runtime-negative guest rejected before execution/);
  assert.match(runner, /verify_runtime_negative/);
  assert.match(runner, /outcome.state !== 'PASS'/);
  const gate = readFileSync(resolve(root, 'scripts/runtime_negative_verdict.mjs'), 'utf8');
  assert.match(gate, /check.status !== 0/);
  assert.match(gate, /execution.status === 0/);
  assert.equal((bad.match(/holder\.take_task\(\)/g) || []).length, 2);
  assert.match(bad, /rt take self\.producer/);
});

test('runtime-negative guest must print its unique first-take breadcrumb', () => {
  const fixture = readFileSync(resolve(root, 'tests/negative/double_field_take.ores'), 'utf8');
  const runner = readFileSync(resolve(root, 'scripts/test_guest.mjs'), 'utf8');
  assert.match(fixture, /stdio\.println\("RX_TASK_FIRST_FIELD_TAKE_COMMITTED"\)/);
  assert.match(runner, /expectedStdout: 'RX_TASK_FIRST_FIELD_TAKE_COMMITTED\\n'/);
  assert.match(runner, /expectedStdout: negative\.expectedStdout/);
});
