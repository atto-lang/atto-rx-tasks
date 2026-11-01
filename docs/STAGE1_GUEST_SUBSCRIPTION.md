# Experimental TaskSubscription stage

Status: Oreslang guest compiler NOT_EXECUTED. This is an isolated real
Oreslang source candidate, not imported by stable src/rx.ores.

Implemented:
- TaskStreamEvent<T> has NEXT/COMPLETE/CANCELLED tag predicates. Only NEXT
  is emitted in this partial slice; FAILED and COMPLETE emission are pending.
- TaskSubscription<T>.next_task(): Option<Task<TaskStreamEvent<T>>> transfers
  a single source Task by rt take into one owned observer Task on demand.
  No self capture in the child, implicit Future bridge or additional producer.
- cancel(): bool can only win before demand; after admission it returns false.
  It does not claim to detach a pending observer or cancel another owner Task.
- No prefetch. Already-running external producer Tasks are not prevented from
  starting by absence of demand; zero demand only prevents extra observer Tasks.

Strict limitations:
1. This Option-based one-demand API is not the promised final
   next_task(): Task<StreamEvent<T,E>>; repeated demand is denied rather than
   delivering COMPLETE. Source-level FAILED/E and physical get_done pending.
2. No atomic multi-carrier admission: sole mutable owner is required, and
   compiler must reject unsafe aliases/concurrent method calls.
3. rt take self.producer and nested Task capture require executable TypeChecker,
   ownership and scheduler proof on an exact Task-enabled compiler branch.
4. Cancellation during an in-flight await is deliberately unsupported until
   authenticated waiter detach and physical TaskScope retirement exist.
5. Actor panic goes to supervisor CONTROL, never into ordinary stream Err.
6. No Task guest compiler or runtime tests have executed for this source.

Admission:
- Test source-free contracts with node --test tests/*.test.mjs.
- Run authenticated exact Task compiler with ORES_CLASSPATH, ORES_COMPILER_REPO,
  ORES_COMPILER_SHA and ORES_COMPILER_TREE_SHA.
- Set ORES_TEST_STAGE1=1 to add this separate experimental guest fixture.
- Add compiler-negative double-transfer, invalid borrow and aliasing tests
  before claiming TaskSubscription compiler admission.
- Implement compiler/runtime detachable observer, terminal arbitration and
  TaskScope physical retirement before expanding RX operators.

Tracked by https://github.com/ores-truffle-oreslang/rx-ores-tasks/issues/2


## Concrete compiler-admission correction (2026-10-31)

The Task compiler branch's `OwnershipChecker` explicitly checks
`rt take` from `Ast.MemberExpr` and rejects any class field whose
`bindingKind` is not `LET`. The original `val Task<T> producer` field
therefore made this source's `rt take self.producer` impossible.
It is now `let Task<T> producer`, with no implicit copy.

This is **necessary but not sufficient**: extracting a class-field
owner twice is not statically prevented merely by field mutability.
Only a unique, non-aliased subscription receiver and its serialized
`demand_claimed` state prevent a second transfer in this experimental
source. The exact native checker and negative tests still need
execution; a production implementation must use compiler-backed affine
field state or an authenticated single-claim runtime handle.


## Exact compiler negative guest fixtures

`tests/negative/immutable_task_field.ores` must reject with
`immutable/final class field`. A generic parser error is NOT a valid
pass.

`tests/negative/double_move_task.ores` must reject with a
move/ownership-specific diagnostic, not a missing module or task
syntax error.

Both are enabled by `ORES_TEST_STAGE1=1`; the runner requires a
nonzero `--check` exit AND the expected diagnostic regex. These
fixtures complement the real JUnit tests proposed in
https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2375,
but are not executable evidence until the exact Task compiler runs.


## Runtime double-field-take regression (Java Task draft #2375)

`tests/negative/double_field_take.ores` must compile or pass through
guest execution and **fail at runtime** with `already moved`. This
detects the distinction between compiler-local affine Task tracking
and the backing class-field store: simply returning the same host Task
handle twice was previously possible because `rt take` was an
identity-level operation. The Java Task evaluator draft now proposes
a moved-slot sentinel in BOTH synchronous and suspendable evaluation,
with atomic class-field consumption and reads rejecting the marker.

The runner tests this only with the exact Task-enabled compiler and
`ORES_TEST_STAGE1=1`. This is an **authored oracle**, not a runtime
receipt. The Java production patch and its regression test remain
unexecuted while Actions runner admission is blocked.

## Exact verifier hardening following merge

The experimental source was merged to main before native Task guest acceptance
was established. Merging did not constitute compiler or runtime proof.
This follow-up stays in a separate draft PR.

The runtime-negative oracle now has a mandatory **two-stage** verdict:
1. `--check tests/negative/double_field_take.ores` must SUCCEED.
2. The same fixture is then executed; only runtime failure with
   `already moved` is a regression PASS.

Previously, a compiler failure with the matching text could accidentally
be mistaken for an executed runtime ownership check. The gate now fails
closed with `NOT_EXECUTED` when compiler admission fails.


## Strict negative-guest receipt and local verification (2026-10-31)

The `double_field_take.ores` runtime-negative oracle now requires:

1. Exact compiler `--check` returns zero and emits no `: error:` diagnostic.
2. A separate guest launch actually completes without process/signal/spawn failure.
3. The guest launcher returns **exit 1** (runtime failure), never exit 0
   or exit 2 (CLI-usage failure).
4. **stderr** (not stdout) contains an `oreslang: ... already moved`
   diagnostic. The typed source/lineage preflight still runs before this.
5. Nonzero usage exits, stdout spoofing, unrelated stderr and failures
   before execution must all fail closed.

This is a **test-verifier acceptance contract**, not a proof that the
Oreslang runtime has executed. Eleven source-free Node unit tests were
actually executed locally using Node.js 22.16.0, **11 PASS / 0 FAIL**.
The exact locally tested `scripts/runtime_negative_verdict.mjs` blob
SHA is `a77f9e72e78dc3371ac0092ca7f91f46882872a5`; the
`tests/runtime_negative_verdict.test.mjs` blob SHA is
`f70ad26ebc5867780a143eb2e8539a82b267a721`.
Both local `git hash-object` results matched these committed blob IDs.

The Java compiler source policy requires a protected source `main`
**and** an independently reviewed exact numeric private-carrier
allowlist entry. On this audit, `main protected:false` and no carrier
is approved. Consequently cross-organization private-source mirroring
remains blocked. Historical alternate-org stepful successes do not
guarantee today's private Actions minutes. The exact RX and Java
source workflows have recorded zero executed steps and must remain
`NOT_EXECUTED`.


## Runtime-negative verifier v2: exact guest-phase evidence (2026-10-31)

The new source-free helper and `.ores` fixture require:
- Successful `--check` on the negative fixture before launching it.
- One guest line printed immediately **after** the first class-field
  `rt take`: `RX_TASK_FIRST_FIELD_TAKE_COMMITTED`.
- Runtime exit **1**, not CLI usage exit 2 or guest success exit 0.
- An exact `oreslang: class field 'TaskCell.producer' was already moved`
  stderr diagnostic, not an arbitrary matching string or stdout spoof.
- No additional stdout, no signalled/failed child process, no cross-file
  ownership error accepted as a valid target.

The first copy of this change overescaped the regex and expected newline.
That was corrected **before acceptance**. The following **exact committed
bytes were materialized, hashed independently with local `git hash-object`,
and actually executed with Node 22.16.0**:

- `scripts/runtime_negative_verdict.mjs`: `d9f02f7a77a750b958659bbb164f5395cd47ed7e`
- `tests/runtime_negative_verdict.test.mjs`: `99162a1ddc2f1cd43fdeca9e42f0f8f47187ce4d`

Result: **14 tests / 14 PASS / 0 FAIL / 0 SKIPPED** for the
source-free verifier (not the compiler, not the `.ores` runtime).
`tests/task_subscription_contract.test.mjs` was updated to remove
obsolete assertions against the replaced verifier implementation;
its standalone execution is not independently verified in this note.

The latest source org RX PR #4 CI run `41235872724`, job
`124639422540`, failed with **zero executed steps**. The focused
Java compiler PR #2375 and RX PR #4 remain draft. Java source `main`
remains `protected: false`, and its cross-org private CI allowlist
is empty, so no private compiler tree was exported to a carrier.
