// Source-free, deterministic Task/Rx protocol model. It does NOT execute .ores
// code, prove Java/LLVM scheduler behavior, or authenticate compiler handles.
import test from 'node:test';
import assert from 'node:assert/strict';

const TERMINALS = ['complete', 'failed', 'cancelled'];

class TaskRxReference {
  constructor({ owner = 'subscriber', producerOwned = false, producerPermit = null } = {}) {
    this.owner = owner;
    this.producerOwned = producerOwned;
    this.producerPermit = producerPermit;
    this.terminal = null;
    this.terminalPublications = 0;
    this.generation = 1;
    this.pending = null;
    this.nextTicket = 1;
    this.values = [];
    this.subscriberClaimed = false;
    this.subscriberAuthority = null;
    this.detachCount = 0;
    this.producerCancelCount = 0;
    this.children = new Set();
    this.childNextId = 1;
    this.cleanupClaims = 0;
    this.cleanupFailed = false;
    this.logicalSettled = false;
    this.producerPhysicallyRetired = false;
    this.observerPhysicallyRetired = false;
  }
  subscribe({ owner = this.owner, generation = this.generation } = {}) {
    if (owner !== this.owner || generation !== this.generation) return null;
    if (this.subscriberClaimed) return null; // affine/hot one-consumer source
    this.subscriberClaimed = true;
    this.subscriberAuthority = Object.freeze({ owner, generation });
    return this.subscriberAuthority;
  }
  authorized(capability) {
    return !!capability && this.subscriberClaimed &&
      capability === this.subscriberAuthority &&
      capability.owner === this.owner && capability.generation === this.generation;
  }
  demand(capability) {
    if (!this.authorized(capability) || this.terminal !== null || this.pending !== null) return null;
    const ticket = { owner: this.owner, generation: this.generation, id: this.nextTicket++ };
    this.pending = ticket;
    return ticket;
  }
  value(ticket, value) {
    if (this.terminal !== null || !this.pending || ticket !== this.pending) return false;
    if (ticket.generation !== this.generation || ticket.owner !== this.owner) return false;
    this.values.push(value);
    this.pending = null;
    return true;
  }
  settle(kind) {
    if (!TERMINALS.includes(kind)) throw new Error('invalid terminal kind');
    if (this.terminal !== null) return false;
    this.terminal = kind;
    this.terminalPublications++;
    if (this.pending !== null) { this.pending = null; this.detachCount++; }
    this.cleanupClaims++;
    return true;
  }
  cancel() {
    return this.settle('cancelled'); // observer detaches only, never producer.cancel
  }
  ownerCancelProducer(permit) {
    if (!this.producerOwned || permit == null || permit !== this.producerPermit) return false;
    if (this.producerCancelCount) return false;
    this.producerCancelCount++;
    return true; // cancellation REQUEST, not physical retirement
  }
  childStart(capability) {
    if (!this.authorized(capability) || this.terminal !== null) return null;
    const child = Object.freeze({ id: this.childNextId++, generation: this.generation });
    this.children.add(child);
    return child;
  }
  childRetire(child) {
    if (!this.children.delete(child)) return false;
    return true;
  }
  failCleanup() { this.cleanupFailed = true; }
  producerExit() { this.producerPhysicallyRetired = true; }
  observerExit() { this.observerPhysicallyRetired = true; }
  logicalCompletion() { this.logicalSettled = true; }
  canReleaseRegion() {
    return this.terminal !== null && this.children.size === 0 &&
      this.observerPhysicallyRetired && !this.cleanupFailed &&
      (!this.producerOwned || this.producerPhysicallyRetired);
  }
}

test('one affine subscriber and one pending demand; no unrequested value', () => {
  const s = new TaskRxReference();
  const c = s.subscribe();
  assert.ok(c);
  assert.equal(s.subscribe(), null);
  assert.equal(s.value({ id: 1 }, 5), false);
  const t = s.demand(c);
  assert.ok(t);
  assert.equal(s.demand(c), null);
  assert.equal(s.value(t, 5), true);
  assert.equal(s.value(t, 6), false);
  assert.deepEqual(s.values, [5]);
  assert.ok(s.demand(c));
});

test('reject foreign owner and stale generation before child or demand admission', () => {
  const s = new TaskRxReference({ owner: 'actor-A' });
  assert.equal(s.subscribe({ owner: 'actor-B' }), null);
  assert.equal(s.subscribe({ generation: 0 }), null);
  const c = s.subscribe();
  assert.equal(s.demand({ owner: 'actor-B', generation: 1 }), null);
  assert.equal(s.demand({ owner: 'actor-A', generation: 1 }), null); // forged matching fields
  assert.equal(s.childStart({ owner: 'actor-A', generation: 0 }), null);
  assert.ok(s.demand(c));
});

test('cancel pending demand detaches the waiter but never cancels external producer', () => {
  const s = new TaskRxReference();
  const c = s.subscribe();
  const t = s.demand(c);
  assert.ok(t);
  assert.equal(s.cancel(), true);
  assert.equal(s.cancel(), false);
  assert.equal(s.value(t, 42), false);
  assert.equal(s.producerCancelCount, 0);
  assert.equal(s.detachCount, 1);
  assert.equal(s.terminalPublications, 1);
  assert.equal(s.cleanupClaims, 1);
});

test('all terminal permutations preserve the first winner and reject late NEXT', () => {
  for (const first of TERMINALS) for (const second of TERMINALS) for (const third of TERMINALS) {
    const s = new TaskRxReference();
    const c = s.subscribe();
    const ticket = s.demand(c);
    assert.equal(s.settle(first), true);
    assert.equal(s.settle(second), false);
    assert.equal(s.settle(third), false);
    assert.equal(s.value(ticket, 10), false);
    assert.deepEqual([s.terminal, s.terminalPublications, s.cleanupClaims, s.detachCount], [first, 1, 1, 1]);
  }
});

test('terminal before demand prevents Task admission and leaves no registrations', () => {
  for (const kind of TERMINALS) {
    const s = new TaskRxReference();
    const c = s.subscribe();
    s.settle(kind);
    assert.equal(s.demand(c), null);
    assert.equal(s.pending, null);
    assert.equal(s.childStart(c), null);
  }
});

test('cancel request for owned producer is separate authority and does not reclaim its memory', () => {
  const ownerPermit = Object.freeze({ kind: 'owner-task-cancel' });
  const s = new TaskRxReference({ owner: 'a', producerOwned: true, producerPermit: ownerPermit });
  const c = s.subscribe();
  const child = s.childStart(c);
  s.cancel();
  assert.equal(s.ownerCancelProducer({ owner: 'b' }), false);
  assert.equal(s.ownerCancelProducer({ owner: 'a' }), false); // forged matching fields
  assert.equal(s.ownerCancelProducer(ownerPermit), true);
  assert.equal(s.ownerCancelProducer(ownerPermit), false);
  s.logicalCompletion();
  assert.equal(s.canReleaseRegion(), false);
  s.observerExit();
  assert.equal(s.canReleaseRegion(), false);
  s.producerExit();
  assert.equal(s.canReleaseRegion(), false);
  assert.equal(s.childRetire(child), true);
  assert.equal(s.canReleaseRegion(), true);
});

test('observer-owned region can retire after detach, without cancelling a shared producer', () => {
  const s = new TaskRxReference();
  const c = s.subscribe();
  assert.ok(s.demand(c));
  s.cancel();
  assert.equal(s.canReleaseRegion(), false);
  s.observerExit();
  assert.equal(s.canReleaseRegion(), true);
  assert.equal(s.producerPhysicallyRetired, false);
  assert.equal(s.producerCancelCount, 0);
});

test('logical completion or producer exit alone cannot release a Task scope', () => {
  const s = new TaskRxReference({ producerOwned: true });
  const c = s.subscribe();
  const child = s.childStart(c);
  s.logicalCompletion();
  s.producerExit();
  s.observerExit();
  assert.equal(s.canReleaseRegion(), false);
  s.settle('complete');
  assert.equal(s.canReleaseRegion(), false);
  assert.equal(s.childRetire(child), true);
  assert.equal(s.canReleaseRegion(), true);
  assert.equal(s.childRetire(child), false);
});

test('cleanup failure poisons reclamation; never silently treats failure as done', () => {
  const s = new TaskRxReference({ producerOwned: true });
  s.subscribe();
  s.settle('failed');
  s.failCleanup();
  s.observerExit();
  s.producerExit();
  assert.equal(s.canReleaseRegion(), false);
});
