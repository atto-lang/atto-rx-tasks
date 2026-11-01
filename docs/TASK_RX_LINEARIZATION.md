# Native Task RX: linearization and ownership contract (draft)

Status: **PROTOCOL DESIGN; not native implementation or five-backend proof.**

The current Oreslang `src/rx.ores` is a smaller Stage-0 *guest syntax candidate*.
The runnable `tests/task_protocol.test.mjs` is a **source-free Node reference model**
for Stage 1; neither the model nor a green Node test proves guest scheduling,
thread safety, actor isolation, borrowed-memory safety, or real compiler support.

## Mandatory capability distinction

- **External producer**: `from_task(external_task)` observes an independently-owned
  Task. Unsubscription may revoke *our observer capability*, but **must not**
  call `Task.cancel` or suppress other consumers. Its physical retirement is
  *not* a prerequisite for this adapter's own `get_done()`.
- **Scoped owned producer**: `from_task_factory(task_scope, make_task)` is an
  eventual, separate constructor. **Only** this variant owns its child and may
  signal cancellation of that child. Its `get_done()` requires both the
  subscription observer's physical retirement and the owned child's physical
  retirement, in addition to a terminal winner.
- **Affine results**: Task output is single-claim by default. Do not allow
  two subscriptions to claim the same move-only T. Share/replay requires an
  explicit Copy/share type proof and distinct result policy.

## Stage-1 protocol

Exactly one `next_task()` demand may be outstanding per subscription. Source
Task already exists for `from_task`; creating an observer must not spawn a
duplicate producer, and lack of demand must not allocate an unbounded queue.
Stage-1 stream events are `NEXT(T)`, `COMPLETE`, `FAILED(E)`,
`CANCELLED`. A one-shot Task permits at most one NEXT before COMPLETE.
Failure must be a typed error outcome, not a synthetic actor panic.

The winning transition to COMPLETE / FAILED / CANCELLED is **linearizable**.
After a winner, late success, error or cancellation must not produce another
observer event. Completion may race cancellation, but cannot win twice.
A pre-settled source Task may deliver after one successful demand; a
cancel-before-demand must never deliver. A stale-generation or foreign-owner
admission is rejected without mutating subscriber state.

| Event | Before demand | One demand pending | After terminal |
| --- | --- | --- | --- |
| demand | Admit one; drain latched result if ready | Reject duplicate | Reject |
| Task settles (value/error) | Latch one outcome; do not emit | Emit NEXT + COMPLETE or FAILED | No observer emission |
| cancel (external) | Win CANCELLED; revoke observation only | Win CANCELLED; detach observer | No-op |
| cancel (scoped owned) | Win CANCELLED; signal owned child once | Same, but child must still retire | No-op |
| observer retires | Record retirement receipt | Record receipt (does not imply terminal) | Record receipt |
| owned child retires | Record independent receipt | Record independent receipt | Record receipt |

`get_done()` is true **only if** terminal authority + physical observer
retirement + (if source owned) physical producer retirement all hold.
Do not release TaskScope permits, actor arena memory, FFI loans or borrowed
captures before the authentic corresponding owner receipt. An observer
`get_done()` does not establish independently-owned Task quiescence.

## Stage-0 guest safety downgrade (currently in branch)

The isolated Oreslang source currently has neither detached waiter tokens
nor an atomically admissible TaskScope subscription. Consequently its
`cancel()` **rejects cancellation once `next()` has been claimed** (returns
false) rather than falsely announcing a successful detach. It is *not*
thread-safe and must only be invoked by one serialized owner. A suspended
`mut self` may itself be rejected by the source compiler's borrow checker.
This is a blocking runtime-language gate, **not** an excuse to bypass the
borrow checker. No Stage-1 in-flight cancellation promise is made by Stage 0.

## Executable reference and guest gates

Run `node --test tests/task_protocol.test.mjs`
on Node >=20. The source-free test exercises eight assertions groups and
1,440 six-event orderings (720 x external/owned). The model proves
*its own transition logic only*; it is not a proof of true concurrent
interleavings, memory safety, or production runtime correctness.

The **actual guest gate** remains
`ORES_CLASSPATH=... node scripts/test_guest.mjs`.
It must use an approved exact-source Task-enabled compiler with its own
recorded commit and job steps; without ORES_CLASSPATH it exits 2
**NOT_EXECUTED**. Passing Node tests may never substitute for this gate.

Five backends (Java/GraalVM, LLVM, Wasm, Forge, .NET) must each validate:
serial demand admission, adversarial cancel vs completion, typed error
terminal winner, observer detach vs independently-owned producer progress,
owned TaskScope lineage, actor-generation rejection, affine transfer,
true physical retirement, bounded scheduling/fairness, and exact-source
compiler/run/AOT evidence.

Cross-reference: rx-ores issue #21, conformance PR #192, Java Task PRs #1468
and #2070, Java interop issue #2150. Do not merge this draft until genuine
compiler/runtime and conformance gates pass.
