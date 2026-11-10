# AttoLang Task composition and reactive interoperability v2 — candidate contract

**Status: proposed / source-free reference, NOT compiler or guest-runtime implementation.**
This document is a working contract for AttoLang's native `Task<T>` primitive and
`rx-ores-tasks`. It intentionally does not claim compatibility with shipping
Java/GraalVM, LLVM, .NET NativeAOT, Wasm, Cranelift or Forge backends.

## What we adopt, and what we do not

- **Rust futures:** typed composition, owned resource cleanup, explicit
  ownership/borrowing and bounded concurrency. A future's disposal is not
  proof of a transactional rollback or asynchronous cleanup completion.
- **Go goroutines:** simple concurrent task creation, channels/select and
  scheduler fairness. Go context cancellation is cooperative, not a kill signal.
- **Java virtual threads:** intuitive task-per-request coding, cheap blocking
  *at an approved async I/O boundary*, and logical identity independent of
  physical carrier threads. Neither a Java virtual thread nor an AttoLang
  Task guarantees arbitrary native calls are interruptible.

AttoLang **Task is a logical owned execution** with a separately awaitable
result and a physical-retirement receipt. Do not equate Task with an OS thread,
backend Future, Rx subscription or actor incarnation.

## Candidate API (illustrative, NOT accepted guest syntax)

```atto
scope tasks as s {
  let users = s.spawn(fetchUsers())
  let orders = s.spawn(fetchOrders())
  let (u, o) = await Task.all(users, orders)
  return combine(u, o)
} // scope exits only after all owned children have physically retired
```

Desired typed operators (canonical guest APIs use snake_case), with independently testable semantics. Already-started Task observation and lazy TaskStep scope admission must remain distinct:

| Candidate | Semantics | Cancellation ownership |
| --- | --- | --- |
| `Task.map(task, f)` | Transform one successful result; preserve typed failure/cancellation | Borrowed observation never cancels `task` |
| `Task.and_then(task, f)` | Explicit one-to-one bind to another `Task<U>`; no implicit Future/Option flattening | Owned continuation belongs to scope |
| `Task.zip(a,b)` / `all(list)` | Join in deterministic input order; bounded fan-in | Owned members only, physically drain on failure |
| `Task.all_settled(list)` | Preserve Success / Failed / Cancelled without swallowing panic | Does not fabricate cancellation authority |
| `Task.race(list)` | First terminal event; deterministic arbitration rule for exact ties | Cancel owned losers; detach borrowed observation only |
| `Task.first_success(list)` | First Success; otherwise aggregate failures/cancellations | Same owned/borrowed boundary |
| `Task.timeout(task, deadline)` | Deadline requests cancellation; timeout != child quiescence | Owned Task may be cancelled, external Task only detached |
| `Task.retry(factory, policy)` | Construct a **fresh** attempt each time, bounded attempts/backoff | Never rerun an already hot/consumed Task |
| `scope.spawn_blocking(hostFn)` | Separately admitted blocking host operation | Explicit quota/isolation; never block an actor carrier |

`race`/`firstSuccess` must use one immutable candidate snapshot for both
winner selection **and loser cancellation**. A caller-mutated list may not add
unrelated owned Task cancellation authority or suppress original losers.
Use an upper bound (e.g. 65,536) and reject duplicate candidates.

## Cancellation is a two-phase lifecycle

1. An authenticated scope/task owner **requests** cancellation. No implicit
   arbitrary-thread interruption or forced revocation of an external Task.
2. Child stops being admitted to new work, acknowledges the request at a
   cooperative checkpoint/await/approved I/O cancellation boundary, and
   publishes exactly one of Success, Failed, Cancelled. A user-thrown
   cancellation-looking error remains Failed, unless authenticated.
3. Compiler/runtime unwinds guards and `defer`/`finally` exactly once, in
   reverse acquisition order, without running guest callbacks under internal
   actor locks. An ordinary mutex guard should not cross `await` unless its
   suspension-safe ownership contract explicitly allows it.
4. Async cleanup is awaited by a **non-cancellable retirement barrier**.
   Public result notification can occur earlier; `get_done()` cannot succeed
   until physical carrier unwind, child quiescence, waiter unlinking, async
   cleanup and borrowed-region release are all verified. Cleanup failure
   poisons DONE and retains memory/permits fail-closed.
5. Sealed parent scopes refuse new children; stop/cancel cascades transitively.
   No unscoped detached tasks without an explicit supervised lifetime owner.

Compiler-injected cooperative checkpoints at loops/recursion improve fairness
and cancellation for CPU-bound guest code. Native blocking/FFI must use an
explicit isolated bridge and budget; hard security enforcement requires process
or Wasm isolation when guest code cannot be cooperatively interrupted.

## Four locality domains, including trace continuity

- `ThreadLocal<T>`: physical carrier only; **must not** define Task identity.
- `TaskLocal<T>`: task-owned, persists across suspension/carrier migration;
  child inheritance must be explicitly allowlisted and Copy/share-safe.
- `ActorLocal<T>`: actor-incarnation owned, generation fenced, never
  implicitly escaped by a child Task.
- `RequestLocal<T>`: explicit request lifetime, not a synonym for carrier TLS.

Trace context (`traceId`, `spanId`, `parentSpanId`, `actorId`, `taskId`,
`supervisorId`, `cancellationScopeId`, `generation`) accompanies the logical
continuation across `await` and carrier changes. Child spans are parented to
logical spawning context; entered carrier-local tracing state must be
restored/unwound on each poll/resume, not left active across suspension.

## Reactive adapters: explicit, bounded and ownership-safe

The actual repository here is `rx-ores-tasks`; other implementations currently
include `rx-ores` (pull/Future), `rx-oreslang-channels` and
`rx-ores-callbacks`. No independent repository literally named `rx-async`
was confirmed by this contract work; that name needs an exact owner/repo
before any change can be attributed to it.

- `Task<T> -> Observable<T>`: one-shot NEXT then COMPLETE on success, FAILED
  with original typed error on failure, CANCELLED only for authentic cancellation.
  The observer may detach its own waiter; it **must not** cancel an independently
  owned producer Task. Zero demand means zero unbounded prefetch.
- `Observable<T> -> Task<Option<T>>`: explicit first-element conversion with
  one demand and exactly-once subscription disposal, including exception,
  cancellation and timeout exits. Multi-valued stream collection needs an
  explicit bounded collector and overflow policy.
- `Task<T> -> Future<T>`: explicit one-shot observation, preserving distinct
  owner and observer cancellation capabilities.
- `Future<T> -> Task<T>`: requires a fresh owner/scope and admitted execution
  policy; observing a Future must not clone or rerun its producer.
- `Observable<T>.map_async(f, limit)` or equivalent: child tasks belong to
  subscription scope; enforce bounded in-flight children, demand credits,
  deterministic terminal arbitration, and await physical child retirement on
  cancellation. Actor ownership, borrow lifetimes and Send/Sync proofs apply.

Task/Rx adapters do **not** silently convert between hot/cold or owned/borrowed
sources, and do not erase `suspends`, `critical`, `throws/raises/panics` effects.

## Evidence and implementation gate

`tests/task_composition_lifecycle.test.mjs` is a deliberately source-free
Node protocol model. It tests immutable race membership, external observer
cancellation, LIFO async cleanup/physical barrier, fail-closed cleanup errors,
authenticated cancellation, generation/owner fencing, and logical task-local
tracing across carrier migration. **A green Node run is not AttoLang execution.**

To graduate this contract, add real `.atto` guest fixtures and exact-head
compiler-backed positive/negative cases to the shared conformance suite,
then bind each backend's compiled executable and executed stepful test receipt
(steps not empty/null, actual guest outputs and physical-retirement assertions)
to the exact source commit/tree. Source-free canaries and zero-step workflows
must remain `NOT_EXECUTED` for guest capability. Obtain independent review of
cancellation/borrow/actor isolation security before promotion.

Related work: `rx-ores-tasks` issue #2; `rx-ores` issue #21; Java Tasks
#1468, #1887, #2699; platform-conformance #152 and #205.