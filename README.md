# atto-rx-tasks

Reactive task composition and asynchronous execution utilities for AttoLang.

## Purpose

Task composition, cancellation semantics, asynchronous results, and lifecycle guarantees.

## API and contract expectations

- Expose general-purpose interfaces that are usable without an Atto commercial account.
- Document data/ownership semantics, error behavior, and supported runtimes.
- Keep protocol and serialization details portable across relevant AttoLang backends.

## Development and testing

Use checked-in implementation and CI for actual commands. Add behavior-focused tests, including negative cases and lifecycle edge cases; distinguish local unit tests from executed multi-backend conformance.

## Project status

This describes intended scope, not a verified feature matrix. Consult the source tree and exact-commit CI results for implementation status.

## Ecosystem

- [AttoLang](https://github.com/atto-lang)
- [Language specification](https://github.com/atto-lang/atto-spec)
- [Cross-platform conformance](https://github.com/atto-lang/atto-platform-conformance)

## Naming migration and language authority

This repository is maintained at [atto-lang/atto-rx-tasks](https://github.com/atto-lang/atto-rx-tasks); use `https://github.com/atto-lang/atto-rx-tasks.git` for Git remotes and canonical `.atto` source examples. The normative language contract is [atto-spec](https://github.com/atto-lang/atto-spec), with executable guest evidence tracked by [atto-platform-conformance](https://github.com/atto-lang/atto-platform-conformance). Follow current ownership, borrowing, effects, actor, and syntax rules there; do not infer implemented features from a README or unexecuted CI.

## Repository ownership and contribution routing

**Belongs here:** Reactive async task composition, cancellation chains, task-local propagation and Result/Future completion semantics.

**Belongs elsewhere:** Channels/observables in atto-rx-channels; callbacks in atto-rx-callbacks; core structured concurrency semantics in atto-spec.

**Security and portability boundary:** Do not auto-flatten nested Future/Option; test cancellation, ownership, nested failure, resource exhaustion and no stuck carrier threads.

AttoLang is the canonical project name; new source, examples and documentation use `.atto` and the `atto-lang` repository organization. This README defines scope, not feature readiness.

**Acceptance:** name exact source SHA/tree, runtime/toolchain, positive and negative checks and execution receipt before claiming support. Host-only tests and empty CI steps do not prove guest execution.

## Canonical AttoLang migration status

The source-free Node model and the pinned Java six-order `.atto` batch are
separate from full Task RX support. Imported legacy `.ores` adapters require
an audited canonical `.atto` port, and supporting CI should migrate toward
Rust tests. Cancellation, `get_done()`, shared-slot capture and scoped borrow
semantics remain blocked; this PR must not claim a complete native Task engine.

## Executed Java milestone and remaining blockers

The source incubator history and PR #13 contracts are reconciled here with the
existing destination history. The original source status is retained in
[docs/SOURCE_INCUBATOR_STATUS.md](docs/SOURCE_INCUBATOR_STATUS.md); existing guest
adapters remain experimental.

[The bounded six-order .atto batch](examples/native_task/batch.atto) executes on
the pinned Java Task feature branch, with two children per lexical scope,
ordered results `10,20,30,40,50,60` and total `210`. Guest child failure and normal
suspending cleanup also execute. **Native Task RX acceptance remains blocked:**
owned cancellation, individual retirement observation, shared-slot capture and
the existing adapter's borrow checking do not work on this compiler pin.

See [the measured scope, compiler pins, commands and blockers](docs/JAVA_TASK_MILESTONE.md).
The harness returns exit **2** for this partial result; source-free model passes
and these executed subsets do not certify a complete native Task engine or any
other backend.
