// Harness only. Application semantics execute in the checked-in .atto files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pin = JSON.parse(fs.readFileSync(path.join(root, 'compiler.java.lock.json')));
const [compilerArg, outputArg] = process.argv.slice(2);
if (!compilerArg || !outputArg) {
  console.error('Usage: JAVA_HOME=<GraalVM25.0.4> node scripts/run_native_task_java.mjs <compiler-checkout> <external-evidence-dir>');
  process.exit(64);
}
const compiler = fs.realpathSync(compilerArg), output = path.resolve(outputArg);
if (output === root || output.startsWith(root + path.sep) || output === compiler || output.startsWith(compiler + path.sep))
  throw Error('Evidence must be outside both source checkouts');
fs.mkdirSync(output, {recursive:true});
const records = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function invoke(label, command, args, cwd, timeout=30000) {
  const started = new Date().toISOString();
  const p = spawnSync(command, args, {cwd, timeout, maxBuffer:32*1024*1024, env:process.env});
  const stdout = p.stdout ?? Buffer.alloc(0), stderr = p.stderr ?? Buffer.alloc(0);
  fs.writeFileSync(path.join(output, label+'.stdout'), stdout);
  fs.writeFileSync(path.join(output, label+'.stderr'), stderr);
  const record = {label, command, args, cwd, started, finished:new Date().toISOString(),
    exit:p.status, signal:p.signal, error:p.error?.message ?? null,
    stdout_sha256:hash(stdout), stderr_sha256:hash(stderr)};
  records.push(record);
  return {...record, stdout, stderr};
}
function git(dir,...args) {
  const p=spawnSync('git',['-C',dir,...args],{encoding:'utf8',timeout:10000});
  if(p.status!==0)throw Error(p.stderr);
  return p.stdout.trim();
}
function clean(dir) {
  if(git(dir,'status','--porcelain','--untracked-files=no'))throw Error('Dirty source checkout: '+dir);
}
clean(root); clean(compiler);
if(git(compiler,'rev-parse','HEAD')!==pin.commit || git(compiler,'rev-parse','HEAD^{tree}')!==pin.tree)
  throw Error('Compiler commit/tree differs from lock');
const application={commit:git(root,'rev-parse','HEAD'),tree:git(root,'rev-parse','HEAD^{tree}')};
const javaHome=process.env.JAVA_HOME;
if(!javaHome)throw Error('JAVA_HOME must select pinned GraalVM');
const java=path.join(javaHome,'bin/java');
const version=invoke('java-version',java,['-version'],root);
if(version.exit!==0 || !version.stderr.toString().includes(pin.java_version) || !version.stderr.toString().includes('GraalVM'))
  throw Error('Wrong JDK; require Oracle GraalVM '+pin.java_version);
const suites='NativeTaskAttoGuestTest,TaskValueReturnTest,TaskValueReturnHardeningTest,ScopedTaskTest,TaskScopeTest';
// Clean build prevents trusting arbitrary caller-selected class files.
const build=invoke('compiler-clean-build','mvn',['-B','-ntp','clean','test','dependency:build-classpath',
  '-Dmdep.outputFile=target/task-rx-classpath.txt','-Dtest='+suites],compiler,180000);
if(build.exit!==0 || build.signal || build.error)throw Error('Compiler build failed; inspect evidence');
const reports=[];
for(const suite of suites.split(',')) {
  const prefix=suite==='TaskScopeTest'?'dev.oreslang.runtime.':'dev.oreslang.';
  const xml=fs.readFileSync(path.join(compiler,'target/surefire-reports/TEST-'+prefix+suite+'.xml'),'utf8');
  fs.writeFileSync(path.join(output,suite+'.xml'),xml);
  const tag=xml.match(/<testsuite\b[^>]*>/)?.[0]??'';
  const field=n=>Number(tag.match(new RegExp('\\b'+n+'="([0-9]+)"'))?.[1]??NaN);
  if(!(field('tests')>0)||field('failures')!==0||field('errors')!==0||field('skipped')!==0)throw Error('Invalid/nonexecuted JUnit report '+suite);
  reports.push({suite,tests:field('tests'),failures:0,errors:0,skipped:0});
}
const cp=path.join(compiler,'target/classes')+path.delimiter+fs.readFileSync(path.join(compiler,'target/task-rx-classpath.txt'),'utf8').trim();
const jvm=['--enable-native-access=ALL-UNNAMED','-Dpolyglot.engine.WarnInterpreterOnly=false','-cp',cp,'dev.oreslang.launcher.OresMain'];
const cases=[
 {name:'batch',file:'examples/native_task/batch.atto',stdout:'tests/native_task/batch.out'},
 {name:'async-cleanup',file:'tests/native_task/async_cleanup.atto',stdout:'tests/native_task/async_cleanup.out'},
 {name:'child-failure',file:'tests/native_task/child_failure.atto',failure:/order-rejected/},
 {name:'cancel',file:'tests/native_task/cancel.atto',unsupportedRun:/unknown Future instance member cancel/},
 {name:'retirement',file:'tests/native_task/retirement.atto',unsupportedCheck:/await requires Future<T> or ActorRef<T>/},
 {name:'shared-slot',file:'tests/native_task/shared_slot.atto',unsupportedCheck:/Task transfer 'slot' must resolve to concrete owned Send data/},
 {name:'legacy-adapter',file:'src/rx.ores',unsupportedCheck:/cannot await while an ordinary borrow is live/},
 {name:'legacy-stage1',file:'tests/negative/double_field_take.ores',unsupportedCheck:/cannot mutate mutable method receiver 'take_task' through read-only binding 'holder'/}
];
const results=[];
for(const test of cases) {
  const source=path.join(root,test.file);
  const check=invoke(test.name+'-check',java,[...jvm,'--check',source],root);
  const source_sha256=hash(fs.readFileSync(source));
  if(test.unsupportedCheck) {
    if(check.exit!==1 || check.signal || check.error || check.stdout.length || !test.unsupportedCheck.test(check.stderr.toString()))throw Error('Unexpected checker result: '+test.name);
    results.push({name:test.name,file:test.file,source_sha256,status:'UNSUPPORTED_CHECK',expected_diagnostic:test.unsupportedCheck.source});
    continue;
  }
  if(check.exit!==0||check.signal||check.error||check.stdout.length)throw Error('Checker failed: '+test.name);
  const run=invoke(test.name+'-run',java,[...jvm,source],root);
  if(run.signal||run.error)throw Error('Guest infrastructure/timeout failure: '+test.name);
  if(test.stdout) {
    const expected=fs.readFileSync(path.join(root,test.stdout));
    if(run.exit!==0||!run.stdout.equals(expected))throw Error('Guest output/exit mismatch: '+test.name);
    results.push({name:test.name,file:test.file,source_sha256,status:'GUEST_EXECUTED',expected_stdout_hex:expected.toString('hex'),actual_stdout_hex:run.stdout.toString('hex'),exit:run.exit});
  } else {
    const reason=test.failure??test.unsupportedRun;
    if(run.exit!==1||run.stdout.length||!reason.test(run.stderr.toString()))throw Error('Unexpected negative result: '+test.name);
    results.push({name:test.name,file:test.file,source_sha256,status:test.failure?'EXPECTED_GUEST_FAILURE':'UNSUPPORTED_RUNTIME',expected_diagnostic:reason.source,exit:run.exit});
  }
}
clean(root); clean(compiler);
const receipt={date:new Date().toISOString(),application,compiler:pin,junit:reports,results,commands:records,
  launcher_sha256:hash(fs.readFileSync(path.join(compiler,'target/classes/dev/oreslang/launcher/OresMain.class'))),
  verdict:'BLOCKED_NATIVE_TASK_ACCEPTANCE',
  limitations:['Task<T> admission shares internal OresFuture storage','No owned Task cancellation or individual retirement API',
  'No cancellation-during-async-cleanup or safe physical resource reuse proof','No Native Image, JIT or other backend certification'],
  hosted_runs:[]};
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({verdict:receipt.verdict,results,junit_tests:reports.reduce((n,x)=>n+x.tests,0),receipt:path.join(output,'receipt.json')},null,2));
// Exit 2 means acceptance is blocked even when every measured result matches.
process.exitCode=2;
