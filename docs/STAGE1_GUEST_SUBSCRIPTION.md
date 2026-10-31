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
