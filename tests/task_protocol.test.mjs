// Source-free executable model of the proposed native Task RX boundary.
// NEVER treat this as proof that Oreslang Task<T>, guests, or backends execute.
import assert from 'node:assert/strict';
import { test } from 'node:test';

class OneShotTaskRx {
  constructor({ owned = false, generation = 1 } = {}) {
    this.owned = owned;
    this.generation = generation;
    this.demanded = false;
    this.outcome = null;
    this.terminal = null;
    this.received = [];
    this.observer_retired = false;
    this.producer_retired = false;
    this.cancel_signals = 0;
    this.producer_settles = 0;
  }
  admit(generation = this.generation) {
    if (generation !== this.generation || this.demanded || this.terminal) return false;
    this.demanded = true;
    this.#deliver();
    return true;
  }
  settle(kind, value, generation = this.generation) {
    if (generation !== this.generation || this.outcome) return false;
    if (kind !== 'value' && kind !== 'failure') throw new Error('invalid outcome');
    this.outcome = { kind, value };
    this.producer_settles++;
    this.#deliver();
    return true;
  }
  #deliver() {
    if (!this.demanded || !this.outcome || this.terminal) return;
    if (this.outcome.kind === 'value') {
      this.received.push({ kind: 'NEXT', value: this.outcome.value });
      this.terminal = 'COMPLETE';
    } else {
      this.terminal = 'FAILED';
    }
    this.received.push({ kind: this.terminal });
  }
  cancel(generation = this.generation) {
    if (generation !== this.generation || this.terminal) return false;
    this.terminal = 'CANCELLED';
    this.received.push({ kind: 'CANCELLED' });
    if (this.owned) this.cancel_signals++;
    return true;
  }
  retire_observer(generation = this.generation) {
    if (generation !== this.generation || this.observer_retired) return false;
    this.observer_retired = true;
    return true;
  }
  retire_producer(generation = this.generation) {
    if (generation !== this.generation || this.producer_retired) return false;
    this.producer_retired = true;
    return true;
  }
  get_done() {
    return !!this.terminal && this.observer_retired && (!this.owned || this.producer_retired);
  }
  verify() {
    assert.ok(this.producer_settles <= 1);
    assert.ok(this.cancel_signals <= 1);
    assert.equal(this.cancel_signals, this.owned && this.terminal === 'CANCELLED' ? 1 : 0);
    assert.ok(this.received.filter(e => e.kind === 'NEXT').length <= 1);
    assert.ok(this.received.filter(e => ['COMPLETE', 'FAILED', 'CANCELLED'].includes(e.kind)).length <= 1);
    if (this.terminal === 'CANCELLED') assert.deepEqual(this.received, [{ kind: 'CANCELLED' }]);
    if (this.terminal === 'COMPLETE') assert.equal(this.received[0].kind, 'NEXT');
    if (this.get_done()) {
      assert.ok(this.terminal && this.observer_retired);
      if (this.owned) assert.ok(this.producer_retired);
    }
  }
}

function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}

for (const owned of [false, true]) {
  test('task rx ' + (owned ? 'owned' : 'external') + ': terminal and quiescence contract', () => {
    const sub = new OneShotTaskRx({ owned });
    assert.equal(sub.admit(2), false, 'foreign/stale generation rejected');
    assert.equal(sub.admit(), true);
    assert.equal(sub.admit(), false, 'single in-flight demand');
    assert.equal(sub.settle('value', 42), true);
    assert.equal(sub.cancel(), false, 'completed producer cannot be cancelled');
    assert.deepEqual(sub.received, [{ kind: 'NEXT', value: 42 }, { kind: 'COMPLETE' }]);
    assert.equal(sub.get_done(), false, 'logical completion is not physical retirement');
    sub.retire_observer();
    assert.equal(sub.get_done(), !owned);
    sub.retire_producer();
    assert.equal(sub.get_done(), true);
    sub.verify();
  });
  test('task rx ' + (owned ? 'owned' : 'external') + ': cancellation does not leak late completion', () => {
    const sub = new OneShotTaskRx({ owned });
    sub.admit();
    assert.equal(sub.cancel(), true);
    assert.equal(sub.cancel(), false);
    assert.equal(sub.settle('failure', 'late failure'), true);
    assert.equal(sub.admit(), false);
    assert.deepEqual(sub.received, [{ kind: 'CANCELLED' }]);
    assert.equal(sub.cancel_signals, owned ? 1 : 0);
    sub.retire_producer();
    assert.equal(sub.get_done(), false, 'observer must retire too');
    sub.retire_observer();
    assert.equal(sub.get_done(), true);
    sub.verify();
  });
  test('task rx ' + (owned ? 'owned' : 'external') + ': pre-settled failure, no duplicate claim', () => {
    const sub = new OneShotTaskRx({ owned });
    assert.equal(sub.settle('failure', 'typed upstream error'), true);
    assert.equal(sub.settle('value', 7), false);
    assert.equal(sub.admit(), true);
    assert.deepEqual(sub.received, [{ kind: 'FAILED' }]);
    sub.verify();
  });
  test('task rx ' + (owned ? 'owned' : 'external') + ': exhaustive race permutations', () => {
    const ops = ['admit', 'complete', 'fail', 'cancel', 'observer_retire', 'producer_retire'];
    let count = 0;
    for (const order of permutations(ops)) {
      const sub = new OneShotTaskRx({ owned, generation: 101 });
      for (const op of order) {
        switch (op) {
          case 'admit': sub.admit(101); break;
          case 'complete': sub.settle('value', 42, 101); break;
          case 'fail': sub.settle('failure', 'E', 101); break;
          case 'cancel': sub.cancel(101); break;
          case 'observer_retire': sub.retire_observer(101); break;
          case 'producer_retire': sub.retire_producer(101); break;
        }
        sub.verify();
        // Once a terminal wins, no subsequent operation can rewrite it.
        if (sub.terminal) {
          const winner = sub.terminal;
          sub.verify();
          assert.equal(sub.terminal, winner);
        }
      }
      count++;
    }
    assert.equal(count, 720);
  });
}

console.log('RX_TASK_SOURCE_FREE_CONTRACT tests=8 permutations=1440 guest=NOT_EXECUTED');
