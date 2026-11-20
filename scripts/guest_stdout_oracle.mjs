// Strict binary oracle for real Oreslang guest stdout. This function does
// not execute a guest or attest compiler provenance.
export function verify_exact_stdout(actual, oracle) {
  if (!Buffer.isBuffer(actual) || !Buffer.isBuffer(oracle)) {
    throw new TypeError('guest stdout and oracle must be raw Buffers');
  }
  return actual.equals(oracle);
}
