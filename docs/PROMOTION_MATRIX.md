# Task RX promotion matrix

This tracks [rx-ores #21](https://github.com/ores-truffle-oreslang/rx-ores/issues/21) and the separate Task RX source of truth. It is not evidence of backend parity.

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| P0 repository provisioned | private dedicated repo under ores-truffle-oreslang | DONE |
| P1 immutable source provenance | same Git blob SHAs as rx-ores draft #22 for source, fixture, oracle, runner and contract | staged; verify on review |
| P2 source-free reference model | actual nonzero-step Node test run, deterministic terminal + demand + retirement traces | PENDING CI |
| P3 Oreslang compiler syntax | exact Task-enabled compiler commit/tree + `--check` on Task guest | NOT_EXECUTED |
| P4 Oreslang guest runtime | exact Task compiler binaries; smoke fixture golden stdout, negative ownership and error oracles | NOT_EXECUTED |
| P5 cancellation/ownership | concurrent pull rejection, cancellation waiter detachment, affine producer result claims, actor-domain/Send/Sync checks | NOT_IMPLEMENTED |
| P6 structured physical retirement | TaskScope child lineage and actual physical `get_done` before actor arena/borrow release | NOT_IMPLEMENTED |
| P7 cross-backend | independent executed Java, LLVM, .NET, Wasm and Forge parity receipts | NOT_EXECUTED |
| P8 native profiles | GraalVM Native Image, LLVM AOT/sanitizers and other applicable targets | NOT_EXECUTED |

**Critical:** The reference protocol in `tests/reference_protocol.test.mjs` is an abstract source-free model, **not** a test of `src/rx.ores`. CI must never report P3–P8 green on the strength of P2.

## Dependency order

1. Resolve Task guest-language admission and Task-handle ownership on the exact Java compiler branch in [#1468](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/1468).
2. Resolve scoped logical/physical terminal fencing in [#2070](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2070).
3. Implement safe observer projections (without producer-cancellation authority) and typed Task/Future adapters tracked by [#2150](https://github.com/ores-truffle-oreslang/oreslang-source.java/issues/2150).
4. Introduce terminal-tagged `StreamEvent<T,E>`, one in-flight `next_task()`, and end-to-end bounded Task admission in Task RX. Source syntax and name lowering must be proven, not presumed.
5. Execute real source fixtures with negative compile checks, race/replay tests, and immutable test receipts; only then extend map/filter/take/skip and bounded `map_async`.
6. Match pending conformance vectors in [platform conformance #192](https://github.com/ores-truffle-oreslang/oreslang-platform-conformance/pull/192), with per-backend evidence.

Security: private Oreslang compiler source may be used only in its authorized location. Do not transfer private sources to unapproved outside organizations. Runner scheduling/zero-step failures do not prove a guest compile failure.
