// Explicit guest-only test runner. This is NOT run by stable rx-ores CI.
// Example after building an *approved* exact-source Task compiler:
// ORES_CLASSPATH='...' ORES_COMPILER_REPO='...' ORES_COMPILER_SHA='...' ORES_COMPILER_TREE_SHA='...' node scripts/test_guest.mjs
//
// Success requires actual compiler --check AND guest execution. It is not
// inferred from a host model, a zero-step Actions run, or a reference trace.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cp = process.env.ORES_CLASSPATH;
if (!cp) {
  console.error('NOT_EXECUTED: ORES_CLASSPATH missing (requires an exact Task-enabled compiler).');
  process.exit(2);
}
// A caller-selected CLASSPATH is not an authenticated compiler. Require an
// exact, clean Git source checkout and two independently recorded SHA claims.
// The checkout must remain within the authorized source organization/runner.
// This still does not attest binary identity or prove the checked-out source
// was what built the class files: require a clean exact-source build receipt.
const compilerPath = process.env.ORES_COMPILER_REPO;
const expectedCommit = process.env.ORES_COMPILER_SHA;
const expectedTree = process.env.ORES_COMPILER_TREE_SHA;
if (!compilerPath || !/^[0-9a-f]{40}$/.test(expectedCommit || '') ||
    !/^[0-9a-f]{40}$/.test(expectedTree || '')) {
  console.error('NOT_EXECUTED: require ORES_COMPILER_REPO, ORES_COMPILER_SHA and ORES_COMPILER_TREE_SHA.');
  process.exit(2);
}
let compilerRepo;
try { compilerRepo = realpathSync(compilerPath); }
catch {
  console.error('NOT_EXECUTED: compiler checkout path does not exist.');
  process.exit(2);
}
function git(...args) {
  const p = spawnSync('git', ['-C', compilerRepo, ...args], {
    encoding: 'utf8', timeout: 10000, shell: false
  });
  if (p.error || p.status !== 0) {
    console.error('NOT_EXECUTED: cannot authenticate compiler Git checkout.', p.stderr || p.error);
    process.exit(2);
  }
  return p.stdout.trim();
}
if (realpathSync(git('rev-parse', '--show-toplevel')) !== compilerRepo ||
    git('rev-parse', 'HEAD') !== expectedCommit ||
    git('rev-parse', 'HEAD^{tree}') !== expectedTree ||
    git('status', '--porcelain', '--untracked-files=no') !== '') {
  console.error('NOT_EXECUTED: compiler source checkout SHA/tree/cleanliness mismatch.');
  process.exit(2);
}
const java = process.env.JAVA || 'java';
const prefix = ['--enable-native-access=ALL-UNNAMED',
  '-Dpolyglot.engine.WarnInterpreterOnly=false', '-cp', cp,
  'dev.oreslang.launcher.OresMain'];
const src = resolve(root, 'src/rx.ores');
const fixture = resolve(root, 'tests/task_single.ores');
const oracle = readFileSync(resolve(root, 'tests/task_single.out'), 'utf8').trimEnd();

for (const args of [['--check', src], ['--check', fixture], [fixture]]) {
  const result = spawnSync(java, [...prefix, ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    shell: false
  });
  if (result.error || result.status !== 0 || /: error:/.test(result.stderr || '')) {
    console.error('FAIL guest', args, result.error || result.stderr || result.stdout);
    process.exit(1);
  }
  if (args.length === 1 && (result.stdout || '').trimEnd() !== oracle) {
    console.error('FAIL guest expected', JSON.stringify(oracle),
      'actual', JSON.stringify((result.stdout || '').trimEnd()));
    process.exit(1);
  }
}
console.log('PASS guest task_single (source checkout verified, compiled-binary identity UNATTESTED)', expectedCommit, expectedTree);
