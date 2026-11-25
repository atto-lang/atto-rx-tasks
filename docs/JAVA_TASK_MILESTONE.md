# Java Task milestone — 2026-11-10

**Partial JVM guest execution; native Task RX acceptance BLOCKED.**

Application logic is in `.atto`: six orders admitted in batches of two, two
native source `Task<int>` children per lexical scope, results observed in input
order and collected into a checked sum. Expected and actual stdout are byte-exact:
`10\n20\n30\n40\n50\n60\n210\n`. No Node/Python/Channel/Future program computes
these outputs. Node is the process/evidence harness only.

The Task feature branch is Phase 1, not a complete independent native Task
engine. The compiler checks Task admission and ownership and executes Task bodies
on its real continuation scheduler, but uses `OresFuture` internally for result
storage. We do not silently replace the missing native API with public Future
source or claim that this meets the full acceptance requirement.

## Pins and compiler prerequisite

- Compiler PR [#2802](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2802):
  `8b9f566813cdc1042cce4306b59d7123e5d4623d`, tree
  `0021cc8b040ec01ccc9d174efdbc739fc5549770`.
- Stacked on native Task PR #1468 head `48dd11bc6f6d52ee093afdf2f679409ab163cdfa`.
  Its original build failed because the evaluator called package-private
  `OresFuture.whenCompleteRuntime` across packages. The isolated prerequisite
  uses `TaskScope.afterPhysicalDrain` for trusted retirement bookkeeping only.
  It does not expose a Future callback or guest cancellation authority.
- Reused main commit `b52f2b1092c2efdf8fe1341c9ac29b086f0de407` for `.atto` admission;
  the older native branch otherwise rejects that extension.
- Oracle GraalVM `25.0.4+7-LTS-jvmci-b01`, declared Truffle `25.3.4.1`.
  Version mismatch disables JIT optimization; real guest execution uses Truffle's
  fallback interpreter. No version checks disabled. No Native Image claim.
- Clean Maven build and 37 focused JUnit tests pass, including a `.atto` cleanup
  fixture and logical-failure-vs-physical-drain runtime regression.
- Independently tested #2748 head `2ecd6544be40a02643c8292df4224f4557266485`:
  66 runtime tests pass, including both retirement-hook failures. That current-main
  compiler rejects `Task<T>` and asks for contextual `Future<T>`. Its different
  TaskHandle/TaskScope implementation cannot simply be cherry-picked over #1468.

## Executed outcomes

| Case | Measured result | Limit |
|---|---|---|
| `batch.atto` | Check 0; run 0; exact six results + total 210 | At most two children; no durable workflow |
| `child_failure.atto` | Check 0; run 1; `order-rejected`; empty stdout | `UNSAFE_REUSE` never reached |
| `async_cleanup.atto` | Check 0; run 0; `cleanup-enter`, `cleanup-exit`, `scope-retired` in order | Normal cleanup only; no memory reclamation certification |
| `cancel.atto` | Check 0; run 1; `unknown Future instance member cancel` | Native owned cancellation missing; checker also over-admits this call |
| `retirement.atto` | Check 1; `await requires Future<T> or ActorRef<T>; got INSTANCE` | No individual Task `get_done()` API |
| `shared_slot.atto` | Check 1; Task transfer `slot` lacks owned Send admission | No proof of physical slot reuse; not executed |
| existing `src/rx.ores` | Check 1; ordinary borrow live across await | Existing adapter does not graduate |
| existing stage-1 negative fixture | Check 1; read-only holder cannot call mutable `take_task` | Runtime double-take receipt NOT EXECUTED |

Cancellation during asynchronous cleanup, observer detachment without producer
cancellation, and physical retirement before real resource reuse remain
**UNSUPPORTED / NOT PROVEN**. Borrowed-observer cancellation must not be added by
forwarding arbitrary result/Future cancellation to the producer. The correct next
compiler work needs native owner authority, detachable observer waits, cleanup
unwind state surviving cancellation, and a separate physical-retirement witness.
That exceeds this bounded build/admission prerequisite and needs reconciliation
of the divergent Task and TaskHandle branches, not a broad rewrite in this app.

## Reproduce and inspect evidence

```
JAVA_HOME=/Library/Java/JavaVirtualMachines/graalvm-25.jdk/Contents/Home \
node scripts/run_native_task_java.mjs /absolute/path/to/pinned/compiler /external/evidence/directory
```

The harness verifies clean application/compiler Git sources and exact compiler
commit/tree, performs a clean Maven build, checks nonzero JUnit reports, invokes
actual checker/guest processes and compares stdout bytes and specific diagnostics.
It records application commit/tree, source and launcher hashes, full command
arguments, exit/signal/error, timestamps, stderr/stdout files, JUnit XML, and
`receipt.json`. **Exit 2 / BLOCKED_NATIVE_TASK_ACCEPTANCE** is the expected overall
verdict when these measured subset results reproduce; unexpected errors fail.
The receipt binds the application snapshot without putting its own Git hash into
that same snapshot.

Executed locally in `/Users/alexandermills/codes/atto-task-work-01a1c81d`.
Raw logs and machine receipts are outside the checkouts under `evidence/`.
No hosted guest run was requested or counted; `hosted_runs` is empty. Origin merge
checks remain required. No source export for Actions, repo transfer/deletion,
force push, merge or release occurred. Private destination visibility was checked
before reconciling source history. Existing independent destination README/history
and open ownership PR #1 are preserved.

The existing 82 Node model/oracle tests pass separately and remain source-free.
PR #13's source-free composition contract is preserved through history reconciliation;
its models are not credited as guest execution or six-backend parity.
