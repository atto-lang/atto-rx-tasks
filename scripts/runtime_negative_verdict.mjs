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
  const diagnostic = [execution.stderr || '', execution.stdout || ''].join('\n');
  if (execution.status === 0) return { state: 'FAIL', phase: 'runtime', diagnostic };
  if (!expected.test(diagnostic)) return { state: 'FAIL', phase: 'runtime', diagnostic };
  return { state: 'PASS', phase: 'runtime', diagnostic };
}
