// SOURCE-FREE tests: no Oreslang compiler or guest program is invoked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify_exact_stdout } from '../scripts/guest_stdout_oracle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const known = Buffer.from('42\ntrue\nfalse\n', 'utf8');

test('identical oracle bytes pass', () => {
  assert.equal(verify_exact_stdout(known, Buffer.from(known)), true);
});
test('one missing final LF rejects', () => {
  assert.equal(verify_exact_stdout(Buffer.from('42\ntrue\nfalse'), known), false);
});
test('one extra final LF rejects', () => {
  assert.equal(verify_exact_stdout(Buffer.from('42\ntrue\nfalse\n\n'), known), false);
});
test('trailing spaces reject', () => {
  assert.equal(verify_exact_stdout(Buffer.from('42\ntrue\nfalse \n'), known), false);
});
test('CRLF is not byte-identical to LF', () => {
  assert.equal(verify_exact_stdout(Buffer.from('42\r\ntrue\r\nfalse\r\n'), known), false);
});
test('embedded null bytes reject', () => {
  assert.equal(verify_exact_stdout(Buffer.concat([known, Buffer.from([0])]), known), false);
});
test('invalid UTF-8 cannot collapse to the same replacement string', () => {
  assert.equal(verify_exact_stdout(Buffer.from([0xff]), Buffer.from([0xfe])), false);
});
test('a stdout oracle cannot be supplied as an already-trimmed string', () => {
  assert.throws(() => verify_exact_stdout('42', Buffer.from('42')), TypeError);
  assert.throws(() => verify_exact_stdout(Buffer.from('42'), '42'), TypeError);
});
test('source checks do not count as execution or stdout proof', () => {
  const runner = readFileSync(resolve(root, 'scripts/test_guest.mjs'), 'utf8');
  assert.match(runner, /import \{ verify_exact_stdout \}/);
  assert.match(runner, /if \(args.length === 1 && !verify_exact_stdout\(/);
  assert.match(runner, /encoding: null, timeout: 30000/);
  assert.doesNotMatch(runner, /\.trimEnd\(\)/);
});
