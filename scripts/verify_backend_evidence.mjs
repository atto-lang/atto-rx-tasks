// Structural validator for actual backend guest-run receipts.
// IMPORTANT: it does not query GitHub or authenticate signed build provenance.
// Exit 0 means STRUCTURAL_ONLY, never "verified parity".
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hex40 = /^[0-9a-f]{40}$/;
const hex64 = /^[0-9a-f]{64}$/;
const posInt = n => Number.isSafeInteger(n) && n > 0;
const same = (a, b) => a === b;
export const manifest = JSON.parse(readFileSync(resolve(root, 'contracts/task-rx/v1/manifest.json'), 'utf8'));
const digest = b => createHash('sha256').update(b).digest('hex');

export function validateReceipts(report, expectedRxHead, scope = 'all') {
  const errors = [];
  const add = (where, msg) => errors.push(where + ': ' + msg);
  if (!hex40.test(expectedRxHead || '')) add('expected_rx_head', 'required exact 40-hex SHA');
  if (!report || typeof report !== 'object' || Array.isArray(report)) return ['report: missing/object required'];
  if (report.schema !== manifest.schema) add('schema', 'unsupported contract schema');
  const wanted = scope === 'all' ? manifest.backends : manifest.backends.filter(b => b.id === scope);
  if (!wanted.length) add('scope', 'unknown backend');
  const receipts = report.receipts;
  if (!Array.isArray(receipts)) return [...errors, 'receipts: array required'];
  const seen = new Set();
  for (const receipt of receipts) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
      add('receipt', 'object required'); continue;
    }
    const id = receipt.backend;
    const where = String(id);
    const backend = wanted.find(b => b.id === id);
    if (!backend) { add(where, 'unexpected backend'); continue; }
    if (seen.has(id)) { add(where, 'duplicate backend receipt'); continue; }
    seen.add(id);
    if (!same(receipt.source_repository, backend.repo)) add(where, 'backend repository identity mismatch');
    if (!hex40.test(receipt.source_commit || '') || !hex40.test(receipt.source_tree || ''))
      add(where, 'source Git commit AND tree required');
    if (!same(receipt.rx_repository, 'ores-truffle-oreslang/rx-ores-tasks') ||
        !same(receipt.rx_commit, expectedRxHead)) add(where, 'exact RX commit/repository mismatch');
    if (!hex64.test(receipt.compiler_artifact_sha256 || '') ||
        !hex64.test(receipt.source_build_receipt_sha256 || ''))
      add(where, 'compiler binary and source-build receipt SHA-256 required');
    if (receipt.execution_profile !== backend.profile) add(where, 'wrong execution profile');
    const job = receipt.github_job;
    if (!job || typeof job !== 'object' || !posInt(job.run_id) || !posInt(job.job_id) ||
        !hex40.test(job.head_sha || '') || job.head_sha !== expectedRxHead ||
        !posInt(job.runner_id) || typeof job.runner_name !== 'string' || !job.runner_name.trim() ||
        job.conclusion !== 'success' || !Array.isArray(job.steps) ||
        !job.steps.some(s => s && s.name === 'RX Task guest conformance' &&
          s.executed === true && s.conclusion === 'success') ||
        job.steps.some(s => s && (s.conclusion === 'failure' || s.conclusion === 'cancelled')) ||
        !new RegExp('^https://github\\.com/ores-truffle-oreslang/rx-ores-tasks/actions/runs/' +
          (job?.run_id || '') + '(?:$|[/?#])').test(job?.url || '')) {
      add(where, 'missing exact-head, nonzero-step source-org GitHub job receipt');
    }
    const cases = receipt.cases;
    if (!Array.isArray(cases)) { add(where, 'case receipts array required'); continue; }
    const caseSeen = new Set();
    for (const item of cases) {
      const def = manifest.cases.find(c => c.id === item?.id);
      if (!def || caseSeen.has(item.id)) { add(where, 'unknown/duplicate case'); continue; }
      caseSeen.add(item.id);
      const label = where + '/' + def.id;
      if (item.kind !== def.kind || item.execution !== 'oreslang-guest')
        add(label, 'wrong case kind or source-free/host execution');
      if (!hex64.test(item.fixture_sha256 || '') ||
          item.fixture_sha256 !== digest(readFileSync(resolve(root, def.source))))
        add(label, 'fixture bytes SHA-256 mismatch');
      if (def.kind === 'guest-positive') {
        const oracle = digest(readFileSync(resolve(root, def.oracle)));
        if (item.check_exit !== 0 || item.guest_exit !== 0 || item.stdout_sha256 !== oracle)
          add(label, 'compiler check + native guest exit 0 + exact oracle bytes required');
      } else if (def.kind === 'guest-compile-reject') {
        if (!posInt(item.check_exit) || item.check_exit > 125 ||
            item.guest_exit !== null || item.diagnostic_family !== def.diagnostic_family)
          add(label, 'semantic compiler rejection required, not a runtime/parser crash');
      } else {
        if (item.check_exit !== 0 || item.guest_exit !== 1 ||
            item.stdout !== def.stdout_marker + '\n' ||
            item.diagnostic_family !== def.diagnostic_family)
          add(label, 'successful check then precise runtime moved-field rejection required');
      }
    }
    for (const def of manifest.cases) if (!caseSeen.has(def.id)) add(where, 'missing case ' + def.id);
  }
  for (const backend of wanted) if (!seen.has(backend.id)) add('all', 'missing backend ' + backend.id);
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = key => args.find(s => s.startsWith('--' + key + '='))?.slice(key.length + 3);
  const receiptFile = get('receipts'), rxHead = get('rx-head'), scope = get('backend') || 'all';
  if (!receiptFile) {
    console.error('NOT_EXECUTED: --receipts=<path> required; no backend guest runs performed here');
    process.exitCode = 2;
  } else {
    try {
      const errors = validateReceipts(JSON.parse(readFileSync(receiptFile, 'utf8')), rxHead, scope);
      if (errors.length) {
        console.error('BLOCKED: ' + errors.join('\nBLOCKED: '));
        process.exitCode = 1;
      } else {
        console.log('STRUCTURAL_ONLY: receipt schema complete for ' + scope +
          '; independently authenticate GitHub steps, source/build and binaries before claiming toolchain parity');
      }
    } catch (err) {
      console.error('BLOCKED: unreadable or invalid receipt file: ' + err.message);
      process.exitCode = 1;
    }
  }
}
