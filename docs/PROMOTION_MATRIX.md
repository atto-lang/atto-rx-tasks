# Task RX promotion matrix

This tracks [rx-ores #21](https://github.com/ores-truffle-oreslang/rx-ores/issues/21) and the separate Task RX source of truth. It is not evidence of backend parity.

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| P0 repository provisioned | private dedicated repo under ores-truffle-oreslang | DONE |
| P1 immutable source provenance | same Git blob SHAs as rx-ores draft #22 for source, fixture, oracle, runner and contract | staged; verify on review |
| P2 source-free reference model | exact-head nonzero-step Node run and event/demand/retirement traces | 16/16 local source-free tests passed; GitHub CI still NOT_EXECUTED |
| P3 Oreslang compiler syntax | exact Task-enabled compiler commit/tree + `--check` on both guests, stage-1 explicitly enabled | Stage-1 .ores source and fixture authored; NOT_EXECUTED |
| P4 Oreslang guest runtime | exact Task compiler binaries; smoke fixture golden stdout, negative ownership and error oracles | NOT_EXECUTED |
| P5 cancellation/ownership | concurrent pull rejection, cancellation waiter detachment, affine producer result claims, actor-domain/Send/Sync checks | NOT_IMPLEMENTED |
| P6 structured physical retirement | TaskScope child lineage and actual physical `get_done` before actor arena/borrow release | NOT_IMPLEMENTED |
| P7 cross-backend | independent executed Java, LLVM, .NET, Wasm and Forge parity receipts | NOT_EXECUTED |
| P8 native profiles | GraalVM Native Image, LLVM AOT/sanitizers and other applicable targets | NOT_EXECUTED |

**Critical:** The abstract reference tests do not execute either Oreslang source unit. The newly added source-only inspection tests verify superficial admission patterns, not compiler lowering or scheduler execution. CI must never report P3–P8 green on the strength of P2.

## Stage-1 source candidate (NOT_EXECUTED)

- Separate `src/task_subscription.ores` defines `TaskStreamEvent<T>` and one-demand `TaskSubscription<T>`; neither replaces stable `src/rx.ores`.
- `next_task(): Option<Task<TaskStreamEvent<T>>>` moves an already-started producer into exactly one Task observer. It refuses duplicate demand. This is not yet the final full Task<StreamEvent<T,E>> API.
- Cancel can win only before a demand. In-flight cancellation, COMPLETE/FAILED emissions, safe TaskScope get_done and multi-carrier ownership remain **unimplemented**.
- Explicitly set `ORES_TEST_STAGE1=1` in the authenticated guest runner to check and execute `tests/task_subscription.ores`, comparing `tests/task_subscription.out`. Without that flag the additional source is not compiled or run.
- Local Node 22.16.0: `node --check scripts/test_guest.mjs` and `node --test tests/*.test.mjs` completed with **16/16 PASS, zero skips**, for model/preflight/static checks only. Exact Git blob identities verified against local executed copies.
- First latest new-head GitHub run `41225580809` job `124608921835` returned 0 steps: **NOT_EXECUTED**, runner admission still blocked; root cause not established.


## Exact-source guest harness preflight

`scripts/test_guest.mjs` refuses execution without `ORES_CLASSPATH`, `ORES_COMPILER_REPO`, `ORES_COMPILER_SHA` and `ORES_COMPILER_TREE_SHA`. It checks the live Git checkout's HEAD/tree and tracked cleanliness before invoking Java. It does **not** attest the classpath binaries, JDK profile, exact compiler build or runtime conformance; those require separately authenticated clean build logs and artifact identities.

## Dependency order

1. Resolve Task guest-language admission and Task-handle ownership on the exact Java compiler branch in [#1468](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/1468).
2. Resolve scoped logical/physical terminal fencing in [#2070](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2070).
3. Implement safe observer projections (without producer-cancellation authority) and typed Task/Future adapters tracked by [#2150](https://github.com/ores-truffle-oreslang/oreslang-source.java/issues/2150).
4. Introduce terminal-tagged `StreamEvent<T,E>`, one in-flight `next_task()`, and end-to-end bounded Task admission in Task RX. Source syntax and name lowering must be proven, not presumed.
5. Execute real source fixtures with negative compile checks, race/replay tests, and immutable test receipts; only then extend map/filter/take/skip and bounded `map_async`.
6. Match pending conformance vectors in [platform conformance #192](https://github.com/ores-truffle-oreslang/oreslang-platform-conformance/pull/192), with per-backend evidence.

Security: private Oreslang compiler source may be used only in its authorized location. Do not transfer private sources to unapproved outside organizations. Runner scheduling/zero-step failures do not prove a guest compile failure.
