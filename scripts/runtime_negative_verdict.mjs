// Source-free verifier boundary: compiler admission must succeed before
// observing a runtime-negative guest verdict. Does not execute Oreslang.
export function verify_runtime_negative({ file, expected, invoke }) {
  if (typeof file !== 'string' || !file || !(expected instanceof RegExp) ||
      typeof invoke !== 'function') {
    throw new TypeError('invalid runtime-negative verifier configuration');
  }
  const check = invoke(['--check', file]);
  if (!check || check.error || check.signal || check.status !== 0 ||
      /: error:/.test(check.stderr || '')) {
    return { state: 'NOT_EXECUTED', phase: 'compile', diagnostic: check?.stderr || check?.stdout || '' };
  }
  const execution = invoke([file]);
  if (!execution || execution.error || execution.signal || execution.status === null ||
      execution.status === undefined) {
    return { state: 'NOT_EXECUTED', phase: 'runtime', diagnostic: execution?.stderr || '' };
  }
  // OresMain exits 1 for an actual guest/runtime error and 2 for a CLI
  // usage error. Never accept usage errors or an unrelated failure that
  // happens to print the expected phrase to stdout.
  const diagnostic = execution.stderr || '';
  if (execution.status !== 1 || !expected.test(diagnostic)) {
    return { state: 'FAIL', phase: 'runtime', diagnostic };
  }
  return { state: 'PASS', phase: 'runtime', diagnostic };
}
