// SOURCE-FREE negative/admission tests. Synthetic receipts are NOT CI evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifest, validateReceipts } from '../scripts/verify_backend_evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hex40 = 'a'.repeat(40);
const sha = p => createHash('sha256').update(readFileSync(resolve(root, p))).digest('hex');
const make = (backend = manifest.backends[0]) => ({
  backend: backend.id,
  source_repository: backend.repo,
  source_commit: 'b'.repeat(40),
  source_tree: 'c'.repeat(40),
  rx_repository: 'ores-truffle-oreslang/rx-ores-tasks',
  rx_commit: hex40,
  compiler_artifact_sha256: 'd'.repeat(64),
  source_build_receipt_sha256: 'e'.repeat(64),
  execution_profile: backend.profile,
  github_job: {
    run_id: 123456, job_id: 765432, runner_id: 17, runner_name: 'ubuntu-test',
    conclusion: 'success', head_sha: hex40,
    url: 'https://github.com/ores-truffle-oreslang/rx-ores-tasks/actions/runs/123456',
    steps: [{ name: 'RX Task guest conformance', executed: true, conclusion: 'success' }]
  },
  cases: manifest.cases.map(c => ({
    id: c.id, kind: c.kind, execution: 'oreslang-guest', fixture_sha256: sha(c.source),
    ...(c.kind === 'guest-positive' ?
      { check_exit: 0, guest_exit: 0, stdout_sha256: sha(c.oracle) } :
      c.kind === 'guest-compile-reject' ?
      { check_exit: 1, guest_exit: null, diagnostic_family: c.diagnostic_family } :
      { check_exit: 0, guest_exit: 1, stdout: c.stdout_marker + '\n', diagnostic_family: c.diagnostic_family })
  }))
});
const validate = (receipt, scope = receipt.backend) =>
  validateReceipts({ schema: manifest.schema, receipts: [receipt] }, hex40, scope);
const fail = (receipt, needle) =>
  assert.ok(validate(receipt).some(e => e.includes(needle)), JSON.stringify(validate(receipt)));

test('independent Java, LLVM, Wasm, Cranelift, .NET and Forge targets never alias', () => {
  assert.deepEqual(manifest.backends.map(b => b.id),
    ['java', 'llvm', 'wasm', 'cranelift', 'net', 'forge']);
  assert.equal(new Set(manifest.backends.map(b => b.repo)).size, 6);
  assert.equal(new Set(manifest.backends.map(b => b.profile)).size, 6);
  assert.ok(manifest.backends.every(b => b.status !== 'verified'));
});

test('synthetic receipt exercises structural success ONLY; no guest proof', () => {
  assert.deepEqual(validate(make()), []);
  assert.deepEqual(validateReceipts({
    schema: manifest.schema,
    receipts: manifest.backends.map(make)
  }, hex40), []);
});

test('empty and incomplete backend sets fail closed', () => {
  assert.equal(validateReceipts({ schema: manifest.schema, receipts: [] }, hex40).length, 6);
  assert.ok(validateReceipts({ schema: manifest.schema, receipts: [make()] }, hex40)
    .some(e => e.includes('missing backend cranelift')));
});

test('exact RX head and source provenance mandatory', () => {
  const r = make(); r.rx_commit = 'f'.repeat(40); fail(r, 'exact RX commit');
  r.rx_commit = hex40; r.source_tree = 'unknown'; fail(r, 'source Git commit');
});

test('zero-step Actions receipt cannot become a pass', () => {
  const r = make(); r.github_job.steps = []; fail(r, 'nonzero-step');
  r.github_job.steps = [{ executed: false, conclusion: 'success' }]; fail(r, 'nonzero-step');
});

test('checkout-only, runnerless and failed jobs cannot spoof Task RX', () => {
  const r = make();
  r.github_job.steps = [{ name: 'Checkout', executed: true, conclusion: 'success' }];
  fail(r, 'nonzero-step');
  r.github_job.steps = [{ name: 'RX Task guest conformance', executed: true, conclusion: 'success' }];
  r.github_job.conclusion = 'failure'; fail(r, 'nonzero-step');
  r.github_job.conclusion = 'success'; r.github_job.runner_id = 0; fail(r, 'nonzero-step');
  r.github_job.runner_id = 17; r.github_job.steps.push({ name: 'Guest failure', executed: true, conclusion: 'failure' });
  fail(r, 'nonzero-step');
});

test('outside organization run URL and wrong execution SHA blocked', () => {
  const r = make();
  r.github_job.url = 'https://github.com/other-org/ci/actions/runs/123456';
  fail(r, 'source-org GitHub');
  r.github_job.url = 'https://github.com/ores-truffle-oreslang/rx-ores-tasks/actions/runs/123456';
  r.github_job.head_sha = 'f'.repeat(40); fail(r, 'nonzero-step');
});

test('stub/host model never counts as Oreslang guest', () => {
  const r = make(); r.cases[0].execution = 'source-free-model'; fail(r, 'source-free/host');
});

test('compiler-only positive or stdout-only spoof is rejected', () => {
  const r = make(); r.cases[0].guest_exit = null; fail(r, 'exact oracle bytes');
  r.cases[0].guest_exit = 0; r.cases[0].stdout_sha256 = '0'.repeat(64);
  fail(r, 'exact oracle bytes');
});

test('negative double field take must compile and fail as an actual runtime moved slot', () => {
  const r = make();
  const c = r.cases.find(x => x.id === 'double_field_take');
  c.check_exit = 1; fail(r, 'precise runtime moved-field');
  c.check_exit = 0; c.guest_exit = 2; fail(r, 'precise runtime moved-field');
  c.guest_exit = 1; c.stdout = 'spoofed'; fail(r, 'precise runtime moved-field');
});

test('negative compile checks cannot falsely pass due to parse or runtime failure', () => {
  const r = make();
  const c = r.cases.find(x => x.id === 'double_move_task');
  c.guest_exit = 1; fail(r, 'semantic compiler rejection');
  c.guest_exit = null; c.diagnostic_family = 'unsupported_task_syntax';
  fail(r, 'semantic compiler rejection');
});

test('missing, duplicated and unknown case receipts are rejected', () => {
  const r = make(); r.cases.pop(); fail(r, 'missing case');
  r.cases.push({ ...r.cases[0] }); fail(r, 'unknown/duplicate case');
});

test('backend mismatch and profile substitution fail closed', () => {
  const r = make(); r.source_repository = 'ores-truffle-oreslang/oreslang-source.llvm';
  fail(r, 'backend repository identity');
  r.source_repository = manifest.backends[0].repo;
  r.execution_profile = 'fake-future-adapter'; fail(r, 'execution profile');
});

test('unsafe, fractional and Boolean GitHub identities cannot stand in for executed steps', () => {
  for (const [key, value] of [
    ['run_id', 0], ['run_id', Number.MAX_SAFE_INTEGER + 1],
    ['job_id', 1.5], ['runner_id', true], ['runner_id', Number.NaN],
    ['runner_name', ' \t  '],
  ]) {
    const receipt = make();
    receipt.github_job[key] = value;
    fail(receipt, 'nonzero-step');
  }
});

test('run URLs must bind the exact source-org run ID without path or host spoofing', () => {
  const expected = 'https://github.com/ores-truffle-oreslang/rx-ores-tasks/actions/runs/';
  for (const url of [
    expected + '1234567',
    expected + '123456evil',
    'https://github.com/ores-truffle-oreslang/rx-ores-tasks.evil/actions/runs/123456',
    'https://github.com.evil/ores-truffle-oreslang/rx-ores-tasks/actions/runs/123456',
  ]) {
    const receipt = make();
    receipt.github_job.url = url;
    fail(receipt, 'nonzero-step');
  }
});

test('a syntactically valid but foreign fixture digest cannot certify guest execution', () => {
  const receipt = make();
  receipt.cases[0].fixture_sha256 = '0'.repeat(64);
  fail(receipt, 'fixture bytes SHA-256 mismatch');
  receipt.cases[0].fixture_sha256 = sha(manifest.cases[0].source);
  receipt.compiler_artifact_sha256 = 'F'.repeat(64);
  fail(receipt, 'compiler binary and source-build receipt');
});

test('unknown target and malformed receipt do not silently pass', () => {
  assert.ok(validateReceipts({ schema: manifest.schema, receipts: [] }, hex40, 'unknown')
    .some(e => e.includes('unknown backend')));
  assert.ok(validateReceipts(null, hex40).length > 0);
});

test('duplicate guest conformance step names cannot forge unique execution proof', () => {
  const receipt = make();
  receipt.github_job.steps.push({
    name: 'RX Task guest conformance', executed: true, conclusion: 'success'
  });
  fail(receipt, 'nonzero-step');

  // A skipped duplicate cannot be hidden behind a successful same-name step.
  receipt.github_job.steps[0] = {
    name: 'RX Task guest conformance', executed: false, conclusion: 'skipped'
  };
  fail(receipt, 'nonzero-step');
});
