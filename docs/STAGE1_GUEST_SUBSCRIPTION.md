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
