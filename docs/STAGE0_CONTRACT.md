# rx-ores-tasks (incubator; NOT production-ready)

Proposed independent repository: `ores-truffle-oreslang/rx-ores-tasks`.

This directory is an isolated **draft seed** in `rx-ores`; it must be extracted to a dedicated private repo after provisioning. It is NOT imported by the stable `rx-ores/src/rx.ores`, the main test runner, or the main benchmark. No compiler/runtime support or passing guest test is claimed. The stable `compiler.lock` is intentionally unchanged.

## Models are different

| Variant | Data coordination | Producer |
| --- | --- | --- |
| rx-ores | pull; native Future/await | independent Future, or cold values |
| rx-oreslang-channels | bounded/rendezvous Channel + select | sender/channel producer |
| rx-ores-callbacks | synchronous push with Boolean stop | callback invocation |
| **rx-ores-tasks (target)** | structured TaskScope; one admitted Task per demand | scheduler-owned native Task<T>; no Channel or Future conversion required |

Native `Task<T>` blocks have source syntax `task { return value; }` and may be awaited, per Java draft #1468. The pending compiler work does not yet prove this prototype safe. Import/export and `Task<T>` lifetime/move handling must be validated against an exact compiler branch before anything is promoted.

## Stage 0: a narrow Task source

`src/rx.ores` is a deliberately small **prototype** for an *already-started* external Task. It never creates another producer Task; `from_task` simply holds the supplied Task. Its single-use `TaskObservable<T>` exposes `next()`, `cancel()` and `is_cancelled()`. `next()` awaits its source through Oreslang's guest suspension path. No Task-backed per-item stream scheduling, ownership-complete cancellation, or parallel mapper is claimed.

The source is incomplete by design: it is **not** safe to promote until exclusive Task-handle transfer, cancellation while suspended, actor ownership, and terminal arbitration have actual compiler/runtime proofs. In particular, the plain Boolean fields are **not cross-Task atomic admission**. The example only admits serialized use by the owning logical task; concurrent callers must fail closed when the runtime API is implemented.

## Stage 1: independent structured reactive interface (design, not implemented)

- `Observable<T,E>.subscribe(): Subscription<T,E>` with an owned subscription capability.
- `Subscription.next_task(): Task<StreamEvent<T,E>>` admits **at most one** demand and one structured child, no eager prefetch or unbounded pending source tasks.
- `StreamEvent<T,E>` has NEXT, COMPLETE, FAILED and CANCELLED; terminal winner is linearizable. Ordinary typed failure is not actor panic or `raise`.
- `map`, `filter`, `take`, `skip` first; after deterministic conformance, bounded `map_async(max_in_flight)`, merge and error-aware operators.
- Source-owned Task child lifetime is nested in its subscription's TaskScope. An **external** Task is observer-only: unsubscribe detaches the observer but cannot cancel the independent producer.
- `get_done()` means terminal **and** physical retirement of child/descendants/cleanup; do not free actor arenas, scoped borrowed memory or immutable capture authority on mere `await` completion.
- `Task<T>` ↔ `Future<T>` is explicit, separately gated and must not duplicate producers. `from_task` should eventually match cross-backend `Observable.from_task` conformance.

## Audit blockers (2026-10-30)

1. **P0:** Awaited Task handle observation vs producer cancellation authority and affine multi-subscriber result claim: Java issue [#2150](https://github.com/ores-truffle-oreslang/oreslang-source.java/issues/2150), conformance [#192](https://github.com/ores-truffle-oreslang/oreslang-platform-conformance/pull/192).
2. **P0:** Scoped cancellation/physical quiescence before memory release and parent/child lineage: Java draft [#2070](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2070).
3. **P0:** Source `task {}` compiler admission is still a branch feature, not established five-backend support: Java draft [#1468](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/1468).
4. **P0:** Existing Rx cancel/disposal and raw-channel sender races still have draft hardening PRs (#14/#18/#19 in rx-ores, #17/#19/#22/#23/#24/#27 in channels).
5. **P1:** Hard real-time requires bounded allocation, deterministic scheduler admission, reduction/time budget and worst-case latency evidence rather than merely no GC.

## Acceptance checks before implementation promotion

- Guest: correct one-shot emission, empty completion, demand=0, cancel=2nd-call false, repeated `next()` after completion, failure, cancel-vs-complete, independent producer lifetime.
- Negative: no duplicate subscription on affine Task; reject stale-generation/foreign task handle; no reentrancy or unsafe `self` capture across suspension.
- Deterministic interleavings: cancel-before-attach, terminal-vs-cancel, failure-vs-cancel, callback-before-detach-token, cleanup throws, multi-carrier stress.
- Source exact-HEAD compiler + genuine Oreslang guest executable; exact SHA and job steps; native GraalVM and LLVM/other backends tracked distinctly.
- Match the pending Observable/Task/Future conformance manifest and its defined event traces before parity claims.

Tracking issue: https://github.com/ores-truffle-oreslang/rx-ores/issues/21

No private compiler source should be mirrored to an unapproved external organization; the RX prototype and any **source-free** test model are not evidence of compiler implementation.
