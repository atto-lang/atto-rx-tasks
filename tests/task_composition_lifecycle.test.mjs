// Executable SOURCE-FREE design oracle for AttoLang Task composition and Task RX.
// This is not guest AttoLang, GraalVM/LLVM/.NET/Wasm/Forge code, or runtime proof.
import test from 'node:test';
import assert from 'node:assert/strict';

class LogicalTask {
  constructor(id, { owner, generation = 1 } = {}) {
    if (!owner) throw new Error('task owner required');
    this.id = id;
    this.owner = owner;
    this.generation = generation;
    this.cancelRequests = 0;
    this.terminal = null;
    this.unwound = false;
    this.cleanup = [];
    this.cleanupClaimed = false;
    this.cleanupFinished = false;
    this.cleanupError = null;
  }
  defer(cleanup) {
    if (this.cleanupClaimed || this.unwound) throw new Error('retiring task');
    this.cleanup.push(cleanup);
  }
  cancel(owner, generation) {
    if (owner !== this.owner || generation !== this.generation || this.terminal || this.cancelRequests) return false;
    this.cancelRequests++;
    return true; // A REQUEST, not a false claim of terminal cancellation or quiescence.
  }
  settle(kind) {
    if (!['success', 'failed', 'cancelled'].includes(kind)) throw new Error('invalid outcome');
    if (this.terminal) return false;
    // An arbitrary thrown cancellation-shaped exception must settle as failed,
    // not as an authenticated 'cancelled' terminal.
    if (kind === 'cancelled' && !this.cancelRequests) return false;
    this.terminal = kind;
    return true;
  }
  async unwind() {
    if (!this.terminal) throw new Error('cannot retire live task');
    if (this.cleanupClaimed) return false;
    this.cleanupClaimed = true;
    // Models LIFO resource unwinding. A failed cleanup cannot certify DONE.
    for (const cleanup of this.cleanup.reverse()) {
      try { await cleanup(); }
      catch (e) { this.cleanupError ??= e; }
    }
    this.cleanupFinished = true;
    this.unwound = true;
    return true;
  }
  get done() {
    return this.terminal !== null && this.unwound && this.cleanupFinished && this.cleanupError === null;
  }
}

class ScopedComposition {
  constructor(owner, generation = 1) {
    this.owner = owner;
    this.generation = generation;
    this.members = new Map();
    this.sealed = false;
    this.observerDetached = new Set();
  }
  addOwned(task) {
    if (this.sealed || task.owner !== this.owner || task.generation !== this.generation || this.members.has(task)) return false;
    this.members.set(task, 'owned');
    return true;
  }
  observeBorrowed(task) {
    if (this.sealed || task.generation !== this.generation || this.members.has(task)) return false;
    this.members.set(task, 'borrowed');
    return true;
  }
  claimSelection(candidates) {
    if (this.sealed || !Array.isArray(candidates) || !candidates.length || candidates.length > 65536 ||
        candidates.some(task => !this.members.has(task)) || new Set(candidates).size !== candidates.length) {
      throw new Error('invalid composition selection');
    }
    // The exact set selected MUST also be the set permitted to be cancelled.
    return Object.freeze([...candidates]);
  }
  raceWinner(snapshot, winner) {
    if (!snapshot.includes(winner)) throw new Error('not a candidate');
    for (const task of snapshot) {
      if (task === winner) continue;
      if (this.members.get(task) === 'owned') task.cancel(this.owner, this.generation);
      else this.observerDetached.add(task); // Never revoke external producer authority.
    }
  }
  failFast(snapshot, failedTask) {
    this.raceWinner(snapshot, failedTask);
  }
  sealAndCancel() {
    if (this.sealed) return false;
    this.sealed = true;
    for (const [task, relation] of this.members) {
      if (relation === 'owned') task.cancel(this.owner, this.generation);
      else this.observerDetached.add(task);
    }
    return true;
  }
  get retired() {
    return this.sealed && [...this.members].every(([task, relation]) =>
      relation === 'owned' ? task.done : this.observerDetached.has(task));
  }
}

class LogicalContext {
  constructor({ actorId, taskId, traceId, spanId, generation, carrierId, taskLocals = new Map() }) {
    Object.assign(this, { actorId, taskId, traceId, spanId, generation, carrierId });
    this.taskLocals = new Map(taskLocals);
  }
  resume(carrierId) { return new LogicalContext({ ...this, carrierId }); }
  spawnChild(taskId, spanId, inheritableKeys) {
    const inherited = new Map([...this.taskLocals].filter(([key]) => inheritableKeys.has(key)));
    return new LogicalContext({ ...this, taskId, spanId, taskLocals: inherited });
  }
}

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

test('race snapshots candidates; a subsequently inserted unrelated task is not cancelled', () => {
  const scope = new ScopedComposition('actor-A');
  const a = new LogicalTask('a', { owner: 'actor-A' });
  const b = new LogicalTask('b', { owner: 'actor-A' });
  const unrelated = new LogicalTask('unrelated', { owner: 'actor-A' });
  for (const task of [a, b, unrelated]) assert.equal(scope.addOwned(task), true);
  const callerList = [a, b];
  const selection = scope.claimSelection(callerList);
  callerList.pop(); callerList.push(unrelated);
  scope.raceWinner(selection, a);
  assert.equal(b.cancelRequests, 1, 'original owned loser must be cancelled');
  assert.equal(unrelated.cancelRequests, 0, 'late unrelated Task has no cancellation consent');
  assert.equal(a.cancelRequests, 0);
});

test('fail-fast and race detach borrowed observers without cancelling external Task', () => {
  const scope = new ScopedComposition('actor-A');
  const owned = new LogicalTask('owned', { owner: 'actor-A' });
  const external = new LogicalTask('external', { owner: 'actor-B' });
  scope.addOwned(owned); scope.observeBorrowed(external);
  scope.failFast(scope.claimSelection([owned, external]), owned);
  assert.equal(external.cancelRequests, 0);
  assert.equal(scope.observerDetached.has(external), true);
  assert.equal(scope.retired, false, 'no early retirement before scope seal + child quiescence');
});

test('cancellation requests do not manufacture completion; child cleanup is LIFO, async and once', async () => {
  const scope = new ScopedComposition('actor-A');
  const child = new LogicalTask('child', { owner: 'actor-A' });
  scope.addOwned(child);
  const gate = deferred();
  const released = [];
  child.defer(() => { released.push('outer'); });
  child.defer(async () => { await gate.promise; released.push('inner'); });
  scope.sealAndCancel();
  assert.equal(child.cancelRequests, 1);
  assert.equal(child.done, false);
  assert.equal(child.settle('cancelled'), true);
  const unwinding = child.unwind();
  await Promise.resolve();
  assert.equal(scope.retired, false, 'logical terminal is not physical quiescence');
  assert.deepEqual(released, []);
  gate.resolve();
  assert.equal(await unwinding, true);
  assert.deepEqual(released, ['inner', 'outer']);
  assert.equal(child.done, true);
  assert.equal(scope.retired, true);
  assert.equal(await child.unwind(), false, 'cleanup is claimed exactly once');
  assert.equal(scope.sealAndCancel(), false);
});

test('cleanup failure poisons DONE and prevents release of the scope region', async () => {
  const s = new ScopedComposition('actor-A');
  const t = new LogicalTask('t', { owner: 'actor-A' });
  s.addOwned(t);
  t.defer(() => { throw new Error('release-failed'); });
  s.sealAndCancel(); t.settle('cancelled'); await t.unwind();
  assert.equal(t.unwound, true);
  assert.equal(t.done, false);
  assert.equal(t.cleanupError.message, 'release-failed');
  assert.equal(s.retired, false);
});

test('authenticated cancellation is not an ordinary thrown cancellation-like exception', async () => {
  const t = new LogicalTask('t', { owner: 'actor-A' });
  assert.equal(t.settle('cancelled'), false, 'no cancellation authority was requested');
  assert.equal(t.settle('failed'), true, 'user exception is a failure');
  assert.equal(t.cancel('actor-A', 1), false);
  await t.unwind();
  assert.equal(t.done, true);
  assert.equal(t.terminal, 'failed');
});

test('generation and owner fences deny admission; sealed scopes reject new children', async () => {
  const s = new ScopedComposition('actor-A', 17);
  const stale = new LogicalTask('stale', { owner: 'actor-A', generation: 16 });
  const foreign = new LogicalTask('foreign', { owner: 'actor-B', generation: 17 });
  assert.equal(s.addOwned(stale), false);
  assert.equal(s.addOwned(foreign), false);
  assert.equal(s.observeBorrowed(stale), false);
  const child = new LogicalTask('child', { owner: 'actor-A', generation: 17 });
  assert.equal(s.addOwned(child), true);
  assert.throws(() => s.claimSelection([child, child]), /invalid/);
  assert.throws(() => s.claimSelection([]), /invalid/);
  assert.equal(child.cancel('actor-A', 16), false);
  assert.equal(child.cancel('foreign', 17), false);
  s.sealAndCancel();
  assert.equal(s.addOwned(new LogicalTask('late', { owner: 'actor-A', generation: 17 })), false);
  assert.equal(s.observeBorrowed(foreign), false);
  child.settle('cancelled'); await child.unwind();
  assert.equal(s.retired, true);
});

test('task-local and trace context follow logical task across carrier migration, not thread locals', () => {
  const parent = new LogicalContext({
    actorId: 'actor-A', taskId: 'task-1', traceId: 'trace-1', spanId: 'span-parent',
    generation: 8, carrierId: 'thread-1', taskLocals: new Map([['requestId', 'r1'], ['secret', 'private']]),
  });
  const resumed = parent.resume('thread-9');
  assert.equal(resumed.actorId, 'actor-A');
  assert.equal(resumed.traceId, 'trace-1');
  assert.equal(resumed.taskLocals.get('requestId'), 'r1');
  assert.equal(resumed.carrierId, 'thread-9');
  const child = resumed.spawnChild('task-2', 'span-child', new Set(['requestId']));
  assert.equal(child.traceId, parent.traceId);
  assert.equal(child.spanId, 'span-child');
  assert.equal(child.taskLocals.get('requestId'), 'r1');
  assert.equal(child.taskLocals.has('secret'), false, 'task-local inheritance must be allowlisted');
});

console.log('TASK_RX_COMPOSITION source_free_only=1 backend_guest=NOT_EXECUTED');
