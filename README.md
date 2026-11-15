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

## Repository ownership and contribution routing

**Belongs here:** Reactive async task composition, cancellation chains, task-local propagation and Result/Future completion semantics.

**Belongs elsewhere:** Channels/observables in atto-rx-channels; callbacks in atto-rx-callbacks; core structured concurrency semantics in atto-spec.

**Security and portability boundary:** Do not auto-flatten nested Future/Option; test cancellation, ownership, nested failure, resource exhaustion and no stuck carrier threads.

AttoLang is the public name; preserve existing Oreslang/.ores compatibility and use canonical .atto for new portable library source. This README defines scope, not feature readiness.

**Acceptance:** name exact source SHA/tree, runtime/toolchain, positive and negative checks and execution receipt before claiming support. Host-only tests and empty CI steps do not prove guest execution.
