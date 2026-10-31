# rx-ores-tasks

Experimental **native Task-based reactive streams for Oreslang**.

This implementation is intentionally independent of:
- [rx-ores](https://github.com/ores-truffle-oreslang/rx-ores) — pull/Future and `await`
- [rx-oreslang-channels](https://github.com/ores-truffle-oreslang/rx-oreslang-channels) — Channel/select coordination
- [rx-ores-callbacks](https://github.com/ores-truffle-oreslang/rx-ores-callbacks) — synchronous callback push

**Status: incubating.** No production-ready RX Task semantics or cross-backend execution has been established. Draft source and source-free contract tests will be proposed through a pull request before any Task-enabled compiler is pinned.

## Target contracts

- Native, structured `Task<T>` execution; do not require a Channel or convert via Future as the default execution engine.
- Subscription demand and `TaskScope` child admission bounded at every step.
- Four distinct outcomes: NEXT, COMPLETE, FAILED, CANCELLED; terminal arbitration and exactly-once cleanup.
- Cancel a subscription's own waiting/children, never an independently owned producer through an observer handle.
- Actor region/arena and borrow lifetime release only after producer **physical retirement**, not logical Task completion.
- Preserve Send/Sync and affine ownership across Tasks and actor boundaries.
- Verify exact guest-language compiler/runtime execution separately from source-only models and workflow-runner admission.

## Origin and tracking

- Initial experimental source: [rx-ores PR #22](https://github.com/ores-truffle-oreslang/rx-ores/pull/22), in `incubator/rx-ores-tasks/`.
- Task RX design: [rx-ores issue #21](https://github.com/ores-truffle-oreslang/rx-ores/issues/21).
- Required compiler/runtime contracts: [Task implementation #1468](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/1468), [Task retirement #2070](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2070), [Task/Future adapter issue #2150](https://github.com/ores-truffle-oreslang/oreslang-source.java/issues/2150), and [conformance #192](https://github.com/ores-truffle-oreslang/oreslang-platform-conformance/pull/192).

Do not treat a passing source-free model test or a GitHub Actions job with zero executed steps as compiler/runtime evidence.
