# Native Task RX — cross-toolchain admission (2026-11-01)

**Goal:** one Oreslang Task-RX source contract across Java/GraalVM, LLVM,
WASM, Cranelift, .NET Native AOT, and the separately maintained Forge backend.

**Current result: NOT PORTABLE YET.** This is not an implemented runtime parity
PR. There is no confirmed cross-toolchain compile + execute of either RX guest
unit. `contracts/task-rx/v1/manifest.json` is the canonical six-backend
inventory and exact test/negative-fixture list. `scripts/verify_backend_evidence.mjs`
is **only a structural lint** for third-party receipt JSON; it does not call
GitHub, verify signatures, or authenticate compiled binary/source binding.
Its success string is deliberately `STRUCTURAL_ONLY`, never a parity PASS.

## Audited backend limitations

| Backend | Main tree inspected | Native Task RX gate |
| --- | --- | --- |
| Java/GraalVM | `241bd67c39443cc2ef18df7e4ed456454af378c7` | Task source #1468 and scoped lifetime #2070 are draft; source Task ownership and runtime-negative field-take #2375 await real guest evidence |
| LLVM | `31b2fff390adac994d270d6fcbf2f65beb980d2c` | Native `SourceTaskRuntime` and continuation contracts exist but Task RX guest lowering, typed events, scope retirement and native AOT integration are unverified |
| WASM | `be268bee832956fb8ca399f9c6fbc495e3066b73` | The present zero-import Wasm `main(): i64` host explicitly excludes Task/async/actor code; no Task RX compilation can be claimed |
| Cranelift | `bd70ea18873767a14eb7283c96e6bc11578eaacc` | Rust+Cranelift JIT admits a single integer `main` subset only, not class/import/Task/await; NOT a Forge alias |
| .NET | `276c157fd3e760184b9782d90d1b014276d9c1ef` | Shipping Native AOT CIL path is scalar-only; host Task observations do not establish guest Task syntax/lowering |
| Forge | `a98a5e0abec222862278a52e7aaadbb2c674ec97` | C++ bootstrap native codegen lacks source Task, await, ownership and actors; separate target beyond requested five |

Tree SHAs are **audit snapshots**, not backend implementation or successful
CI receipts; new heads require reinspection. Do not silently translate source
Task RX into a Future/Channel host adapter or use a fake scalar fallback.

## Exact guest conformance sequence (for EACH backend)

1. Admit true Oreslang `Task<T>`, `task {}`, `await`, `rt take`, one-shot
   `TaskSubscription<T>` and controlled imports. A codegen that cannot lower
   them must reject explicitly and record `UNSUPPORTED`, not emit a stub.
2. Compile + **execute** `tests/task_single.ores` and
   `tests/task_subscription.ores` against their exact checked-in
   `.out` byte oracles; require a single moved producer Task, no hidden
   Future/Channel conversion, no duplicate `next_task` admission.
3. Reject `tests/negative/immutable_task_field.ores` and
   `double_move_task.ores` with **ownership-specific** compiler errors.
   Parser errors or unknown symbols are not successful negative tests.
4. `double_field_take.ores` MUST pass static admission and then fail
   **at runtime** with the precise moved-field marker + diagnostic, proving
   that backing class-field storage is consumed, not just the compiler model.
5. Implement *additional* Stage-2 adversarial tests before claiming full RX:
   cancellation while pending with authenticated observer detach; external
   producer outliving subscription; cancellation vs success/failure terminal
   winner; stale actor generations; callback scheduler affinity; fairness;
   TaskScope child post-carrier retirement and cleanup poison; Send/Sync +
   affine move; owned/observer memory fencing.
6. Only then measure backend-appropriate actual artifacts: Java interpreter +
   GraalVM Native Image, LLVM native AOT and sanitizers, WASM worker runtime,
   Cranelift native JIT, .NET Native AOT, Forge native C++ stack. Preserve
   **LLVM zero-GC/hard-RT** latency constraints; do not confuse a model
   with actual preemptive or deadline safe scheduling.

The current Stage-0 and Stage-1 guest source are **prototypes**.
In-flight cancellation and full FAILED/COMPLETE events are still missing.
Source-only validation is not a replacement for implementing those semantics.

## Receipt schema lint (source-free, not native execution)

```sh
node --test tests/*.test.mjs
node --check scripts/verify_backend_evidence.mjs
node scripts/verify_backend_evidence.mjs --receipts=receipts.json \
  --rx-head=EXACT_40_HEX_RX_COMMIT --backend=llvm
node scripts/verify_backend_evidence.mjs --receipts=receipts-all.json \
  --rx-head=EXACT_40_HEX_RX_COMMIT
```

The verifier accepts a JSON object with
`schema: "oreslang-rx-task-parity/v1"` and a `receipts` array. One
receipt has backend id, its source Git repository/commit/tree, RX
repository/commit, SHA-256 compiler binary and source-build receipt, the
manifest-defined execution profile, a source-org GitHub job claim
(`run_id`, `job_id`, `head_sha`, run URL, nonempty successful steps),
and all five case receipts. Every case includes its actual fixture SHA-256,
`execution: "oreslang-guest"` and the required compiler/guest exits.
Positive cases must match the SHA-256 of checked-in expected output.
Negative compiler cases require a move/immutable diagnostic family;
double-field-take must check successfully then exit 1 with its exact marker.

**Warning:** JSON is not a signed/protected receipt and the script cannot
determine whether a submitted record is truthful. The `STRUCTURAL_ONLY`
message is *not* a backend pass. Independently inspect the exact GitHub job
steps, private compiler source/build provenance, actual binary digest,
capability/permissions, native and sanitizers logs, and full test output
before changing a release gate. A zero-step Actions job is `NOT_EXECUTED`.

## Sequencing and merge boundaries

- Existing [rx-ores-tasks #4](https://github.com/ores-truffle-oreslang/rx-ores-tasks/pull/4):
  strict runtime negative oracle.
- [#5](https://github.com/ores-truffle-oreslang/rx-ores-tasks/pull/5):
  Stage-0 fail-closed in-flight cancellation.
- [#6](https://github.com/ores-truffle-oreslang/rx-ores-tasks/pull/6)
  and [#7](https://github.com/ores-truffle-oreslang/rx-ores-tasks/pull/7):
  additional native guest candidate suites.

These PRs overlap the Stage-0 source, fixtures and guest runner; do not
merge them without reconciling tests and resolving exact guest evidence.
This parity contract intentionally **does not edit** those paths.
Add compiler-specific source and runner receipts to the dedicated toolchain
repos, run the shared manifest against **each** backend, then open integration
PRs with exact SHA and nonempty CI job steps. Never transfer private source
to an unapproved organization.
