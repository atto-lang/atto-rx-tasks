import test from 'node:test';
import assert from 'node:assert/strict';
import { verify_runtime_negative } from '../scripts/runtime_negative_verdict.mjs';

const file = 'tests/negative/double_field_take.ores';
const expected = /^oreslang: .*already moved\b/m;
const checkOk = { status: 0, stderr: '', stdout: '' };

function probe(check, runtime) {
  const calls = [];
  const outcome = verify_runtime_negative({
    file, expected,
    invoke: args => { calls.push(args); return calls.length === 1 ? check : runtime; }
  });
  return { calls, outcome };
}

test('only an admitted fixture with a real matching runtime failure passes', () => {
  const { calls, outcome } = probe(checkOk, { status: 1, stderr: "oreslang: class field 'TaskCell.producer' was already moved" });
  assert.equal(outcome.state, 'PASS');
  assert.equal(outcome.phase, 'runtime');
  assert.deepEqual(calls, [['--check', file], [file]]);
});

test('compiler failure never counts as runtime evidence even if words match', () => {
  const { calls, outcome } = probe({ status: 1, stderr: ": error: class field 'TaskCell.producer' was already moved" },
    { status: 1, stderr: "oreslang: class field 'TaskCell.producer' was already moved" });
  assert.equal(outcome.state, 'NOT_EXECUTED');
  assert.equal(outcome.phase, 'compile');
  assert.equal(calls.length, 1);
});

test('compiler zero exit with error diagnostic remains rejected', () => {
  const { calls, outcome } = probe({ status: 0, stderr: '/tmp/test.ores:1:1: error: invalid Task' },
    { status: 1, stderr: 'already moved' });
  assert.equal(outcome.state, 'NOT_EXECUTED');
  assert.equal(calls.length, 1);
});

test('a runtime success cannot satisfy a runtime-negative oracle', () => {
  assert.equal(probe(checkOk, { status: 0, stdout: "oreslang: class field 'TaskCell.producer' was already moved" }).outcome.state, 'FAIL');
});

test('unrelated runtime failures cannot satisfy the ownership oracle', () => {
  assert.equal(probe(checkOk, { status: 1, stderr: 'permission denied' }).outcome.state, 'FAIL');
});

test('signal and spawn failures have no execution verdict', () => {
  assert.equal(probe(checkOk, { status: null, signal: 'SIGKILL' }).outcome.state, 'NOT_EXECUTED');
  assert.equal(probe(checkOk, { error: new Error('ENOENT') }).outcome.state, 'NOT_EXECUTED');
});

test('reject invalid verifier configurations before invoking any command', () => {
  assert.throws(() => verify_runtime_negative({ file: '', expected, invoke() {} }), TypeError);
  assert.throws(() => verify_runtime_negative({ file, expected: 'already moved', invoke() {} }), TypeError);
});

test('stdout spoof plus an unrelated runtime failure must fail', () => {
  const outcome = probe(checkOk, {
    status: 1,
    stderr: 'oreslang: unrelated failure',
    stdout: "oreslang: class field 'TaskCell.producer' was already moved"
  }).outcome;
  assert.equal(outcome.state, 'FAIL');
});

test('CLI usage error code 2 is never a moved-field runtime success', () => {
  const outcome = probe(checkOk, {
    status: 2,
    stderr: "oreslang: invalid argument was already moved"
  }).outcome;
  assert.equal(outcome.state, 'FAIL');
});

test('an unprefixed error on stderr is not an OresMain runtime receipt', () => {
  const outcome = probe(checkOk, {
    status: 1,
    stderr: "class field 'TaskCell.producer' was already moved"
  }).outcome;
  assert.equal(outcome.state, 'FAIL');
});

test('failed --check cannot produce a runtime receipt even with a matching stdout', () => {
  const { calls, outcome } = probe({ status: 2, stdout: 'oreslang: already moved' }, {
    status: 1, stderr: "oreslang: class field 'TaskCell.producer' was already moved"
  });
  assert.equal(outcome.state, 'NOT_EXECUTED');
  assert.equal(calls.length, 1);
});
