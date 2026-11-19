> **AI agent instructions (organization-wide):** Before working on code, issues, or pull requests, read and follow the [organization `AGENTS.md`](https://github.com/ores-truffle-oreslang/.github/blob/main/AGENTS.md), including its **merge-first stealth-development policy**. Honor any repository-local `AGENTS.md`, explicit holds, and GitHub-enforced rules.

# rx-ores-tasks

## AttoLang naming migration and language authority (2026-11-18)

The public language name is **AttoLang** (formerly **Oreslang**). This is a historical `ores-truffle-oreslang/rx-ores-tasks` checkout; its current ecosystem routing is **[atto-lang/atto-rx-tasks](https://github.com/atto-lang/atto-rx-tasks)**. Preserve historical implementation and build commands in the rest of this README. A similarly named repository is not evidence of identical commits, GitHub issue/PR history or feature status.

**[atto-lang/atto-spec](https://github.com/atto-lang/atto-spec) is the canonical normative language specification.** Use [atto-platform-conformance](https://github.com/atto-lang/atto-platform-conformance) for executable positive/negative guest fixtures, [atto-compilers-parity-testing](https://github.com/atto-lang/atto-compilers-parity-testing) for cross-backend comparisons, and [atto-common-source](https://github.com/atto-lang/atto-common-source) for portable `.atto` core/std code. Modern proposed language rules include `snake_case` callable naming, `borrow!`/`take!`/`share!`/`copy!`/`copy!!`, [default nonprimitive argument borrowing](https://github.com/atto-lang/atto-spec/blob/main/language/implicit-argument-borrow-v1.md), [static `define const` including one-time `os.read_env`](https://github.com/atto-lang/atto-spec/blob/main/language/file-module-const-v1.md), and [`<<<`/`>>>`/`ashr` shifts versus `<<`/`>>` stream I/O](https://github.com/atto-lang/atto-spec/blob/main/language/bitwise-and-stream-operators-v1.md). Contract status and compiler execution evidence take precedence over old README descriptions.

Retain actual legacy `.ores` files, CLI/package/ABI names and reproducible commands below until each replacement is separately implemented and verified. No Python scripts, CI/test support or generators for new AttoLang work; favor Rust support tooling. No feature or parity claim without exact SHA/tree, toolchain/target, real compiled guest execution and negative tests; host-only tests or zero executed CI steps count as **not executed**.

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
