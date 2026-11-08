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

## Six-toolchain Task RX portability gate

The target is **Java/GraalVM, LLVM, WASM, Cranelift, .NET Native AOT, and independent Forge**. None is currently certified for native Task RX guest execution. See [the audited per-backend contract and exact-source verification sequence](docs/BACKEND_TASK_RX_PORTABILITY.md) and the source-free receipt/schema checks at `contracts/task-rx/v1/manifest.json` and `tests/backend_parity_gate.test.mjs`. Cranelift does **not** share Forge's runtime. A passing Node model or a structurally valid self-asserted CI receipt is **not** executable RX parity.

## Origin and tracking

- Initial experimental source: [rx-ores PR #22](https://github.com/ores-truffle-oreslang/rx-ores/pull/22), in `incubator/rx-ores-tasks/`.
- Task RX design: [rx-ores issue #21](https://github.com/ores-truffle-oreslang/rx-ores/issues/21).
- Required compiler/runtime contracts: [Task implementation #1468](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/1468), [Task retirement #2070](https://github.com/ores-truffle-oreslang/oreslang-source.java/pull/2070), [Task/Future adapter issue #2150](https://github.com/ores-truffle-oreslang/oreslang-source.java/issues/2150), and [conformance #192](https://github.com/ores-truffle-oreslang/oreslang-platform-conformance/pull/192).

Do not treat a passing source-free model test or a GitHub Actions job with zero executed steps as compiler/runtime evidence.

## Repository ownership and migration (2026-11-08)

**AttoLang** is the public language, formerly Oreslang. The repository remains `ores-truffle-oreslang/rx-ores-tasks` in the legacy org until approved cutover. Preserve supported `.ores` sources, old import paths and package/CLI names; don't infer backend completeness from a README.

- **Belongs here:** reactive task composition adapters, cancellation and structured-concurrency semantics.
- **Excluded:** native scheduler or cloud worker administration.
- **Organization split:** [atto-lang](https://github.com/atto-lang) owns portable core/std, compilers, language libraries, test harnesses and demos; [atto-co](https://github.com/atto-co) independently owns cloud hosting, deployment, identity, billing and managed services. Existing `atto-*` repos are not automatically migrated copies or equivalent codebases.
- **Proposed first transfer (not executed):** retain original name, repo ID and Git history in `atto-lang/rx-ores-tasks` via approved GitHub ownership transfer. No direct source-org → `atto-co` moves are authorized currently; future product carve-outs need separate signoffs.

**Maintainer safety procedure:** coordinate exact source head, owners and rollback in [issue #26](https://github.com/ores-truffle-oreslang/.github/issues/26), then follow private [runbook draft #25](https://github.com/ores-truffle-oreslang/.github/pull/25). Obtain source/target admin and independent security approval; inventory exact SHA/tree, numeric ID, target branch protections/rulesets, access, open PRs, releases/tags, packages, consumers, Actions/runners, secrets, GitHub Apps, webhooks and Pages. Don't clone/mirror private code as transfer workaround. After transfer verify ID/tree/history/controls, update links and rerun exact-head CI; **`steps=[]`/`null` is `NOT_EXECUTED`**, and host-only/source-free checks are not native guest/compiler evidence.
