# Stage-1 cancellation and retirement acceptance

**Scope:** independent native-Task Rx, [P0 issue #2](https://github.com/ores-truffle-oreslang/rx-ores-tasks/issues/2). Source-free protocol test `tests/task_lifetime_races.test.mjs` is a *reference specification*, not Oreslang runtime implementation.

## Exact interleaving obligations

1. One hot/affine producer can only have one authenticated consumer. For owned, cold sources use fresh independent storage or prove read-only sharing; never double-move `T`.
2. A subscription can admit one demand at a time. Admission returns a generation-bound capability token. A late source frame may not win after terminal, even if the scheduler already began resumption.
3. Precisely one terminal kind (COMPLETE, FAILED, CANCELLED) wins. A terminal winner releases pending observer registration once, but an **independent producer's** cancellation authority is never transferred to the observer.
4. A Task owner can request cancellation once; the request, the terminal result, and physical post-carrier retirement remain different events.
5. Reclamation requires terminal claim, physical observer retirement, all owned children retired, and—only when the adapter owns the producer—physical producer retirement. A cleanup failure poisons reclamation.
6. Invalid owner or generation must never admit child scheduling or demand. Actual runtime must mint opaque identity capabilities; the model tests object identity rejection for forged lookalikes, but still does not authenticate runtime actor identities.
7. All Task callbacks execute on the owning scheduler, not under producer/JNI/IO completion threads or actor locks. There must be zero hidden prefetch and bounded pending callbacks.
8. Model invariants must be independently enforced by Oreslang tests and exact compiler/runtime receipts before promotion. The reference test checks logic only, not thread-safety, memory fences, runtime ownership enforcement, or five-backend parity.

## Priorities

- **P0** Read-only source compiler admission check for `Task<T>` in [Java #1468](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/1468) and guest Task observation/cancellation contract in [Java issue #2150](https://github.com/ores-truffle-oreslang/oreslang-source.java/issues/2150).
- **P0** Enforce atomic subscription claim + cancellation waiter detachment, explicit terminal events, and actual child physical retirement in Oreslang; [Java #2070](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2070) carries TaskScope lineage dependencies.
- **P0** Obtain a GitHub Actions run with real executed steps; zero-step failed jobs are **NOT_EXECUTED**. A locally passing Node test is not backend test evidence.
- **P1** `map`, `filter`, `take`, `skip` and bounded `map_async` after the P0 substrate is compiled, ownership-safe and cancellable.
