// Source-free reference protocol ONLY. Does not import/run Oreslang or prove native Task behavior.
import test from 'node:test';
import assert from 'node:assert/strict';

class ReferenceSubscription {
  constructor({ ownsProducer = false } = {}) {
    this.state = 'active';
    this.pending = false;
    this.requests = 0;
    this.nextValues = [];
    this.terminalEvents = [];
    this.detachCount = 0;
    this.producerCancelCalls = 0;
    this.ownsProducer = ownsProducer;
    this.physicallyRetired = false;
    this.liveChildren = 0;
  }
  request() {
    if (this.state !== 'active' || this.pending) return false;
    this.pending = true;
    this.requests++;
    return true;
  }
  next(value) {
    if (this.state !== 'active' || !this.pending) return false;
    this.pending = false;
    this.nextValues.push(value);
    return true;
  }
  terminal(kind) {
    if (this.state !== 'active') return false;
    this.state = kind;
    this.pending = false;
    this.terminalEvents.push(kind);
    return true;
  }
  cancel() {
    if (!this.terminal('cancelled')) return false;
    this.detachCount++;
    // A detached observation cannot revoke an externally-owned producer.
    return true;
  }
  complete() { return this.terminal('complete'); }
  fail() { return this.terminal('failed'); }
  childStart() { if (this.state !== 'active') return false; this.liveChildren++; return true; }
  childRetire() { if (this.liveChildren <= 0) throw Error('invalid child retire'); this.liveChildren--; }
  producerRetire() { this.physicallyRetired = true; }
  canReleaseRegion() {
    return this.state !== 'active' && this.physicallyRetired && this.liveChildren === 0;
  }
}

test('zero demand means no emitted values or Task admission', () => {
  const s = new ReferenceSubscription();
  assert.equal(s.requests, 0);
  assert.equal(s.next(7), false);
  assert.deepEqual(s.nextValues, []);
});

test('one outstanding demand; exactly one value admission; no hidden prefetch', () => {
  const s = new ReferenceSubscription();
  assert.equal(s.request(), true);
  assert.equal(s.request(), false);
  assert.equal(s.next(42), true);
  assert.equal(s.next(99), false);
  assert.equal(s.requests, 1);
  assert.deepEqual(s.nextValues, [42]);
  assert.equal(s.request(), true);
  assert.equal(s.requests, 2);
});

test('cancellation wins pending demand and does not cancel an external producer', () => {
  const s = new ReferenceSubscription();
  s.request();
  assert.equal(s.cancel(), true);
  assert.equal(s.cancel(), false);
  assert.equal(s.next(7), false);
  assert.equal(s.complete(), false);
  assert.equal(s.producerCancelCalls, 0);
  assert.equal(s.detachCount, 1);
  assert.deepEqual(s.terminalEvents, ['cancelled']);
});

test('completion and failure have distinct, immutable terminal outcomes', () => {
  const completed = new ReferenceSubscription();
  assert.equal(completed.complete(), true);
  assert.equal(completed.fail(), false);
  assert.equal(completed.cancel(), false);
  assert.equal(completed.request(), false);
  assert.deepEqual(completed.terminalEvents, ['complete']);
  const failed = new ReferenceSubscription();
  assert.equal(failed.fail(), true);
  assert.equal(failed.complete(), false);
  assert.deepEqual(failed.terminalEvents, ['failed']);
});

test('every permutation of terminal contenders yields only the first terminal', () => {
  for (const first of ['complete','cancel','fail']) {
    for (const second of ['complete','cancel','fail']) {
      for (const third of ['complete','cancel','fail']) {
        const s = new ReferenceSubscription();
        s.request();
        assert.equal(s[first](), true);
        assert.equal(s[second](), false);
        assert.equal(s[third](), false);
        assert.equal(s.terminalEvents.length, 1);
        assert.equal(s.next(9), false);
      }
    }
  }
});

test('logical terminal never releases an unretired producer or scoped child', () => {
  const s = new ReferenceSubscription({ownsProducer: true});
  assert.equal(s.childStart(), true);
  assert.equal(s.complete(), true);
  assert.equal(s.canReleaseRegion(), false);
  s.producerRetire();
  assert.equal(s.canReleaseRegion(), false);
  s.childRetire();
  assert.equal(s.canReleaseRegion(), true);
});

test('physical retirement alone is not a terminal witness', () => {
  const s = new ReferenceSubscription();
  s.producerRetire();
  assert.equal(s.canReleaseRegion(), false);
  s.cancel();
  assert.equal(s.canReleaseRegion(), true);
});

test('subscriber-local cancellation has no producer cancellation authority', () => {
  const s = new ReferenceSubscription({ownsProducer: false});
  assert.equal(s.cancel(), true);
  assert.equal(s.producerCancelCalls, 0);
  assert.equal(s.physicallyRetired, false);
  assert.equal(s.canReleaseRegion(), false);
});
