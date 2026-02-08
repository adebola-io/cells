import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Cell, SourceCell } from '../library/index.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Cells', () => {
  test('Creates a reactive Cell of type T', () => {
    const cell = Cell.source(1);
    expect(cell.get()).toBe(1);
  });

  test('Cell should be reactive', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback);
    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });

  test('Cell should ignore updates for deeply equal values', () => {
    const cell = Cell.source({
      a: 1,
      b: { c: 2, d: 3 },
    });
    const callback = vi.fn();
    cell.listen(callback);

    cell.set({
      a: 1,
      b: { c: 2, d: 3 },
    });
    expect(callback).toHaveBeenCalledTimes(0);

    cell.set({
      a: 1,
      b: { c: 2, d: 4 },
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Creates a reactive Cell with null or undefined', () => {
    /** @type {SourceCell<any>} */
    const nullCell = Cell.source(null);
    expect(nullCell.get()).toBeNull();
    /** @type {SourceCell<any>} */
    const undefinedCell = Cell.source(undefined);
    expect(undefinedCell.get()).toBeUndefined();

    const callbackNull = vi.fn();
    nullCell.listen(callbackNull);
    nullCell.set(1);
    expect(callbackNull).toHaveBeenCalledWith(1);
    nullCell.set(undefined);
    expect(callbackNull).toHaveBeenCalledWith(undefined);

    const callbackUndefined = vi.fn();
    undefinedCell.listen(callbackUndefined);
    undefinedCell.set('test');
    expect(callbackUndefined).toHaveBeenCalledWith('test');
    undefinedCell.set(null);
    expect(callbackUndefined).toHaveBeenCalledWith(null);
  });
});

describe('Effects', () => {
  test('Cell should handle nested subscriptions', () => {
    const cell = Cell.source(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const unsubscribe1 = cell.listen(callback1);
    const unsubscribe2 = cell.listen(callback2);
    cell.set(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith(2);
    unsubscribe1();
    cell.set(3);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledWith(3);
    unsubscribe2();
  });

  test('Multiple once:true listeners should all fire', () => {
    const cell = Cell.source(1);
    const values1 = [];
    const values2 = [];
    const values3 = [];

    cell.listen((v) => values1.push(v), { once: true });
    cell.listen((v) => values2.push(v), { once: true });
    cell.listen((v) => values3.push(v), { once: true });

    cell.set(2);

    expect(values1).toEqual([2]);
    expect(values2).toEqual([2]);
    expect(values3).toEqual([2]);

    // After once, they should not fire again
    cell.set(3);
    expect(values1).toEqual([2]);
    expect(values2).toEqual([2]);
    expect(values3).toEqual([2]);
  });

  test('Cell should handle unsubscribe', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    const unsubscribe = cell.listen(callback);
    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    cell.set(3);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Cell should handle multiple subscriptions and un-subscriptions', () => {
    const cell = Cell.source(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const unsubscribe1 = cell.listen(callback1);
    const unsubscribe2 = cell.listen(callback2);
    const unsubscribe3 = cell.listen(callback3);
    cell.set(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    unsubscribe2();
    cell.set(3);
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
    unsubscribe1();
    unsubscribe3();
    cell.set(4);
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
  });

  test('listen should handle errors in callback', () => {
    const cell = Cell.source(1);
    const errorCallback = vi.fn(() => {
      throw new Error('Listener error');
    });
    const normalCallback = vi.fn();

    cell.listen(errorCallback);
    cell.listen(normalCallback);

    expect(() => {
      cell.set(2);
    }).toThrow('Errors occurred during cell update cycle');

    // Check if the normal callback was still called despite the error in the first one.
    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect(normalCallback).toHaveBeenCalledTimes(1);
    expect(normalCallback).toHaveBeenCalledWith(2);
  });

  test('Listener with { once: true } should only run once', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { once: true });

    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
    cell.set(3);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Cells should have updated values when read in effects', () => {
    const cell = Cell.source(1);
    const derivedCell = Cell.derived(() => cell.get() * 2);

    let message = '';
    cell.listen(() => {
      message = `The derived cell is ${derivedCell.get()}`;
    });

    cell.set(2);

    expect(message).toEqual('The derived cell is 4');
  });

  test('Cells should work properly if updated in effects', () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const callback = vi.fn();
    const c = Cell.derived(() => {
      callback();
      return a.get() + b.get();
    });
    expect(callback).toHaveBeenCalledTimes(1); // initial run.
    expect(c.get()).toBe(3);

    a.listen(() => {
      b.set(a.get() * 2);
    });

    a.set(2);
    expect(b.get()).toBe(4);
    expect(c.get()).toBe(6);
    expect(callback).toHaveBeenCalledTimes(3); // once again when a is set, again when b is set.
  });

  test('should update derived cells when source cell is set inside an effect', () => {
    const trigger = Cell.source(0);
    const index = Cell.source(10);
    const doubled = Cell.derived(() => index.get() * 2);

    // Effect that updates another source cell
    trigger.listen(() => {
      index.set(5);
    });

    expect(doubled.get()).toBe(20);

    trigger.set(1);

    expect(index.get()).toBe(5);
    expect(doubled.get()).toBe(10); // Should be 10, not stale 20
  });

  test('should propagate through multiple levels of derived cells', () => {
    const trigger = Cell.source(false);
    const base = Cell.source(1);
    const level1 = Cell.derived(() => base.get() + 1);
    const level2 = Cell.derived(() => level1.get() + 1);
    const level3 = Cell.derived(() => level2.get() + 1);

    trigger.listen(() => {
      base.set(10);
    });

    expect(level3.get()).toBe(4); // 1 + 1 + 1 + 1

    trigger.set(true);

    expect(level1.get()).toBe(11);
    expect(level2.get()).toBe(12);
    expect(level3.get()).toBe(13);
  });

  test('should handle multiple source cells updated in a single effect', () => {
    const trigger = Cell.source(0);
    const a = Cell.source(1);
    const b = Cell.source(2);
    const sum = Cell.derived(() => a.get() + b.get());

    trigger.listen(() => {
      a.set(10);
      b.set(20);
    });

    expect(sum.get()).toBe(3);

    trigger.set(1);

    expect(sum.get()).toBe(30);
  });

  test('should handle effects on derived cells that update source cells', () => {
    const root = Cell.source(1);
    const derived = Cell.derived(() => root.get() * 2);
    const secondary = Cell.source(0);
    const final = Cell.derived(() => secondary.get() + 100);

    derived.listen((value) => {
      secondary.set(value);
    });

    expect(final.get()).toBe(100);

    root.set(5);

    expect(derived.get()).toBe(10);
    expect(secondary.get()).toBe(10);
    expect(final.get()).toBe(110);
  });

  test('effects should cascade if synchronized manually', () => {
    const a = Cell.source(1);
    const b = Cell.source(a.get() + 1);
    const sum = Cell.source(a.get() + b.get());

    a.listen(() => {
      b.set(a.get() + 1);
    });

    b.listen(() => {
      sum.set(b.get() + a.get());
    });

    a.set(2);
    expect(b.get()).toBe(3);
    expect(sum.get()).toBe(5);
  });

  test('Does not lead to infinite loop on effect write, if value is the same', () => {
    const text = Cell.source('Hello');
    const view = Cell.source(text.get());

    expect(text.get()).toBe('Hello');

    text.listen(() => {
      view.set(text.get());
    });

    view.listen(() => {
      text.set(view.get());
    });

    text.set('Hello, world.');
    expect(view.get()).toBe('Hello, world.');

    view.set('This is a message.');
    expect(text.get()).toBe('This is a message.');
  });
});

describe('Derived cells', () => {
  test('Creates a reactive Derived cell of type T', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => cell1.get() + cell2.get());
    expect(derived.get()).toBe(3);
  });

  test('Derived cell objects should be reactive', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => ({
      a: cell1.get() + cell2.get(),
    }));
    const a = Cell.derived(() => derived.get().a);
    expect(derived.get()).toEqual({ a: 3 });

    cell1.set(3);
    expect(a.get()).toEqual(5);
  });

  test('Derived cell should be reactive', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => cell1.get() + cell2.get());
    const callback = vi.fn();
    derived.listen(callback);
    cell1.set(3);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(5);

    const name = Cell.source('John');
    const surname = Cell.source('Smith');
    const fullname = Cell.derived(() => `${name.get()} ${surname.get()}`);
    expect(fullname.get()).toBe('John Smith');

    name.set('Jane');
    expect(fullname.get()).toBe('Jane Smith');
  });

  test('Derived cell should handle multiple dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const cell3 = Cell.source(3);
    const derived = Cell.derived(() => cell1.get() + cell2.get() + cell3.get());
    const callback = vi.fn();
    derived.listen(callback);
    cell1.set(4);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(9);
    cell2.set(5);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(12);
    cell3.set(6);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith(15);
  });

  test('Derived cells should not depend on same cell multiple times', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback);

    const derived1 = Cell.derived(() => cell.get() + cell.get());
    expect(derived1.get()).toBe(2);

    cell.set(3);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Derived cell should handle nested dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived1 = Cell.derived(() => cell1.get() + cell2.get());
    const derived2 = Cell.derived(() => derived1.get() * 2);
    const callback = vi.fn();
    derived2.listen(callback);
    cell1.set(3);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
    cell2.set(4);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(14);
  });

  test('Derived cell should handle circular dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2); // 4
    const derived1 = Cell.derived(() => cell2.get() + 1);
    const derived2 = Cell.derived(() => derived1.get() + cell1.get());

    cell2.set(derived2.get());
    expect(cell2.get()).toBe(4);
    expect(derived2.get()).toBe(6);

    const callback = vi.fn();
    derived2.listen(callback);

    cell1.set(3);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(8);
  });

  test('Derived cell should handle multiple subscriptions and unsubscriptions', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => cell1.get() + cell2.get());
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const unsubscribe1 = derived.listen(callback1);
    const unsubscribe2 = derived.listen(callback2);
    const unsubscribe3 = derived.listen(callback3);
    cell1.set(3);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    unsubscribe2();
    cell2.set(4);
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
    unsubscribe1();
    unsubscribe3();
    cell1.set(5);
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
  });

  test('Cell.derived should not update if the value is the same', () => {
    const cell = Cell.source('hello');
    const callback = vi.fn();

    const derived = Cell.derived(() => {
      return cell.get().length;
    });
    expect(derived.get()).toBe(5);

    derived.listen(callback);

    cell.set('world');

    expect(derived.get()).toBe(5);

    expect(callback).toHaveBeenCalledTimes(0);
  });

  test('Derived cell should update in the order of dependencies', () => {
    const source = Cell.source('Hello');

    let string = '';
    const derived1 = Cell.derived(() => {
      string += '1';
      return source.get().length;
    });
    const derived2 = Cell.derived(() => {
      string += '2';
      return `${source.get()} World`;
    });
    expect(derived1.get()).toBe(5);
    expect(derived2.get()).toBe('Hello World');
    expect(string).toBe('12');

    source.set('Goodbye');
    expect(derived1.get()).toBe(7);
    expect(derived2.get()).toBe('Goodbye World');
    expect(string).toBe('1212');

    const derived3 = Cell.derived(() => {
      string += '3';
      return `${source.get()} Universe`;
    });
    expect(derived3.get()).toBe('Goodbye Universe');
    expect(string).toBe('12123');

    const derived4 = Cell.derived(() => {
      string += '4';
      return derived1.get() * 2;
    });
    expect(derived4.get()).toBe(14);

    const derived5 = Cell.derived(() => {
      string += '5';
      return `${derived2.get()}${derived2.get()}`;
    });
    expect(derived5.get()).toBe('Goodbye WorldGoodbye World');

    string = '';
    source.set('Welcome!');
    expect(string).toBe('12345');
  });

  test('Nested derived cells should only be updated once', () => {
    const cell = Cell.source(1);
    const derived = Cell.derived(() => cell.get() + 1);
    const derived2 = Cell.derived(() => cell.get() + 3);

    const callback = vi.fn();
    const derived3 = Cell.derived(() => {
      callback();
      return derived.get() + derived2.get();
    });

    expect(derived3.get()).toBe(6);
    expect(callback).toHaveBeenCalledTimes(1);

    cell.set(2);

    expect(derived3.get()).toBe(8);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Derived cell should handle null/undefined results', () => {
    const cell = Cell.source(0);
    const derived = Cell.derived(() => (cell.get() > 0 ? cell.get() : null));
    expect(derived.get()).toBeNull();

    const callback = vi.fn();
    derived.listen(callback);

    cell.set(5);
    expect(derived.get()).toBe(5);
    expect(callback).toHaveBeenCalledWith(5);

    cell.set(-1);
    expect(derived.get()).toBeNull();
    expect(callback).toHaveBeenCalledWith(null);

    const derivedUndefined = Cell.derived(() =>
      cell.get() > 0 ? cell.get() : undefined,
    );
    expect(derivedUndefined.get()).toBeUndefined();
    const callbackUndefined = vi.fn();
    derivedUndefined.listen(callbackUndefined);

    cell.set(10);
    expect(derivedUndefined.get()).toBe(10);
    expect(callbackUndefined).toHaveBeenCalledWith(10);

    cell.set(0);
    expect(derivedUndefined.get()).toBeUndefined();
    expect(callbackUndefined).toHaveBeenCalledWith(undefined);
  });

  test('derived cell should handle errors in computed function', () => {
    const source = Cell.source(1);
    const derived = Cell.derived(() => {
      if (source.get() < 0) {
        throw new Error('Value cannot be negative');
      }
      return source.get() * 2;
    });

    expect(derived.get()).toBe(2);

    // Test error during update
    expect(() => {
      source.set(-1);
    }).toThrow('Errors occurred during cell update cycle');

    // Check that the derived value remains the last valid computed value
    expect(derived.peek()).toBe(2); // Use peek to avoid re-computation triggering error again

    // Reset source to valid state and check if derived cell recovers
    source.set(5);
    expect(derived.get()).toBe(10); // Should compute correctly now

    // Test error during initial computation
    const source2 = Cell.source(-1);
    expect(() => {
      Cell.derived(() => {
        if (source2.get() < 0) {
          throw new Error('Initial value cannot be negative');
        }
        return source2.get() * 2;
      }).get(); // Access .get() to trigger computation
    }).toThrow('Errors occurred during cell update cycle');
  });

  test('More complex derivations across depths', () => {
    const A = Cell.source(10);
    const B = Cell.source(12);

    const dependenceC = Cell.source('B');
    const dependenceD = Cell.source('A');

    const C = Cell.derived(() => {
      switch (dependenceC.get()) {
        case 'A':
          return A.get() * 2;
        case 'B':
          return B.get() * 3;
        default:
          return 0;
      }
    });

    const D = Cell.derived(() => {
      switch (dependenceD.get()) {
        case 'A':
          return A.get() * 2;
        case 'B':
          return B.get() * 3;
        default:
          return 0;
      }
    });

    const E = Cell.derived(() => C.get() + D.get());
    expect(E.get()).toBe(56);
    dependenceC.set('A');
    expect(E.get()).toBe(40);
    dependenceD.set('B');
    B.set(40);
    dependenceD.set('A');
    expect(E.get()).toBe(40);

    A.set(2);
    expect(E.get()).toBe(8);
  });

  test('Glitch Test: Diamond dependency pattern', () => {
    const source = Cell.source(1);
    const derivedA = Cell.derived(() => source.get() * 2);
    const derivedB = Cell.derived(() => derivedA.get() + 1);
    const derivedC = Cell.derived(() => derivedB.get() * 3);
    const derivedD = Cell.derived(() => derivedC.get() + derivedA.get());

    expect(derivedD.get()).toBe(11);

    const callbackD = vi.fn();
    derivedD.listen(callbackD);

    source.set(4);

    expect(derivedA.get()).toBe(8);
    expect(derivedB.get()).toBe(9);
    expect(derivedC.get()).toBe(27);
    expect(derivedD.get()).toBe(35);

    expect(callbackD).toHaveBeenCalledTimes(1);
    expect(callbackD).toHaveBeenCalledWith(35);
  });

  test('Glitch Test: Mathematical Constraint Violation', () => {
    const number = Cell.source(10);
    const toggle = Cell.source(false);

    const double = Cell.derived(() => {
      if (toggle.get()) return number.get() * 2;
      return 0;
    });

    const sum = Cell.derived(() => {
      return number.get() + double.get();
    });

    expect(sum.get()).toBe(10);
    toggle.set(true);
    expect(sum.get()).toBe(30);

    number.set(20);
    expect(sum.get()).toBe(60);
  });

  test('Glitch Test: Zombie Child (Array/Index Mismatch)', () => {
    const listType = Cell.source('A');
    const toggle = Cell.source(false);

    const listData = Cell.derived(() => {
      if (toggle.get()) {
        return listType.get() === 'A' ? ['Item A1', 'Item A2'] : ['Item B1'];
      }
      return ['Item A1', 'Item A2'];
    });

    const selection = Cell.derived(() => {
      const type = listType.get();
      const data = listData.get();

      return `${type}:${data.length}`;
    });

    toggle.set(true);
    expect(selection.get()).toBe('A:2');

    listType.set('B');

    expect(selection.get()).toBe('B:1');
  });

  test('Glitch Test: intermediate derived dependency with large depth', () => {
    const a = Cell.source(0);
    const b = Cell.source(1);
    const c = Cell.source(2);
    const d = Cell.derived(() => b.get() * 2);
    const e = Cell.derived(() => d.get() * 2);
    const f = Cell.derived(() => e.get() * 2);
    const g = Cell.derived(() => f.get() * 2);
    const h = Cell.derived(() => b.get() * g.get());
    const i = Cell.derived(() => a.get() + h.get() + c.get());

    expect(h.get()).toBe(16);
    expect(i.get()).toBe(18);

    a.set(10);
    expect(h.get()).toBe(16);
    expect(i.get()).toBe(28);
  });
});

describe('Batched effects', () => {
  test('Batched effects should run only once', () => {
    const callback = vi.fn();

    const cell = Cell.source(1);
    cell.listen(callback);

    Cell.batch(() => {
      cell.set(2);
      cell.set(3);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Batched derived cells should only be derived once.', () => {
    const callback = vi.fn();

    const cell = Cell.source(2);
    const derived = Cell.derived(() => {
      callback();
      return cell.get() * 2;
    });
    expect(derived.get()).toEqual(4);

    Cell.batch(() => {
      cell.set(80);
      cell.set(100);

      expect(derived.get()).toEqual(4);
    });

    expect(callback).toHaveBeenCalled();
    expect(derived.get()).toEqual(200);
  });

  test('Batched derived cells should update once regardless of dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => {
      return cell1.get() + cell2.get();
    });
    const callback = vi.fn();
    derived.listen(callback);

    Cell.batch(() => {
      cell1.set(3);
      cell2.set(4);

      cell1.set(5);
      cell2.set(6);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(derived.get()).toBe(11);
  });

  test('Nested batched effects should still only run once', () => {
    const callback = vi.fn();
    const cell = Cell.source(2);
    cell.listen(callback);

    Cell.batch(() => {
      cell.set(100);
      cell.set(90);

      Cell.batch(() => {
        cell.set(10);
        cell.set(1);
      });
    });

    expect(callback).toHaveBeenCalled();
  });

  test('Batched effects should handle errors in callback', () => {
    const cell = Cell.source(1);
    const listenerCallback = vi.fn();
    cell.listen(listenerCallback);

    expect(() => {
      Cell.batch(() => {
        cell.set(2);
        throw new Error('Batch error');
        // This next line should not be reached
        // cell.set(3);
      });
    }).toThrow('Errors occurred during cell update cycle');

    // The cell value should reflect the last successful assignment *before* the error.
    expect(cell.get()).toBe(2);
    // Ensure that listener was still called despite the error in the batch.
    expect(listenerCallback).toHaveBeenCalledTimes(1);

    // Ensure subsequent updates still work
    cell.set(4);
    expect(listenerCallback).toHaveBeenCalledTimes(2);
    expect(listenerCallback).toHaveBeenCalledWith(4);
  });

  test('Batch should return the value from the callback', () => {
    const cell = Cell.source(5);
    const result = Cell.batch(() => {
      cell.set(10);
      return cell.peek() * 2;
    });
    expect(result).toBe(20);
  });

  test('Empty batch should not trigger any effects', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback);

    Cell.batch(() => {
      // No changes
    });

    expect(callback).not.toHaveBeenCalled();
  });

  test('Batch with deeply nested derived cells chain', () => {
    const source = Cell.source(1);
    const derivedA = Cell.derived(() => source.get() * 2);
    const derivedB = Cell.derived(() => derivedA.get() + 1);
    const derivedC = Cell.derived(() => derivedB.get() * 3);

    const callbackA = vi.fn();
    const callbackB = vi.fn();
    const callbackC = vi.fn();

    derivedA.listen(callbackA);
    derivedB.listen(callbackB);
    derivedC.listen(callbackC);

    Cell.batch(() => {
      source.set(2);
      source.set(3);
      source.set(4);
    });

    // Each derived should only update once
    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);
    expect(callbackC).toHaveBeenCalledTimes(1);

    // Final values should be correct
    expect(derivedA.get()).toBe(8); // 4 * 2
    expect(derivedB.get()).toBe(9); // 8 + 1
    expect(derivedC.get()).toBe(27); // 9 * 3

    // Verify callbacks were called with correct final values
    expect(callbackA).toHaveBeenCalledWith(8);
    expect(callbackB).toHaveBeenCalledWith(9);
    expect(callbackC).toHaveBeenCalledWith(27);
  });

  test('Batch should work with multiple cells having multiple listeners', () => {
    const cellA = Cell.source(1);
    const cellB = Cell.source(2);

    const listenerA1 = vi.fn();
    const listenerA2 = vi.fn();
    const listenerB1 = vi.fn();
    const listenerB2 = vi.fn();

    cellA.listen(listenerA1);
    cellA.listen(listenerA2);
    cellB.listen(listenerB1);
    cellB.listen(listenerB2);

    Cell.batch(() => {
      cellA.set(10);
      cellB.set(20);
      cellA.set(100);
      cellB.set(200);
    });

    expect(listenerA1).toHaveBeenCalledTimes(1);
    expect(listenerA1).toHaveBeenCalledWith(100);
    expect(listenerA2).toHaveBeenCalledTimes(1);
    expect(listenerA2).toHaveBeenCalledWith(100);
    expect(listenerB1).toHaveBeenCalledTimes(1);
    expect(listenerB1).toHaveBeenCalledWith(200);
    expect(listenerB2).toHaveBeenCalledTimes(1);
    expect(listenerB2).toHaveBeenCalledWith(200);
  });

  test('Peek should return new value during batch', () => {
    const cell = Cell.source(1);

    Cell.batch(() => {
      cell.set(10);
      // peek should return the new value since it was set in the batch
      expect(cell.peek()).toBe(10);
      cell.set(20);
      expect(cell.peek()).toBe(20);
    });

    expect(cell.peek()).toBe(20);
  });

  test('Batch isolation - sequential batches should not interfere', () => {
    const cell = Cell.source(0);
    const listener = vi.fn();
    cell.listen(listener);

    Cell.batch(() => {
      cell.set(1);
      cell.set(2);
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2);

    Cell.batch(() => {
      cell.set(3);
      cell.set(4);
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(4);
  });

  test('Batch should handle multiple errors and throw aggregated error', () => {
    const cellA = Cell.source(1);
    const cellB = Cell.source(2);
    const errorListenerA = vi.fn(() => {
      throw new Error('Error A');
    });
    const errorListenerB = vi.fn(() => {
      throw new Error('Error B');
    });

    cellA.listen(errorListenerA);
    cellB.listen(errorListenerB);

    expect(() => {
      Cell.batch(() => {
        cellA.set(10);
        cellB.set(20);
      });
    }).toThrow('Errors occurred during cell update cycle');

    // Both listeners should have been called despite errors
    expect(errorListenerA).toHaveBeenCalled();
    expect(errorListenerB).toHaveBeenCalled();
  });

  test('Batch with derived cells reading from multiple sources', () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const c = Cell.source(3);

    const derivedCallback = vi.fn();
    const derived = Cell.derived(() => {
      derivedCallback();
      return a.get() + b.get() + c.get();
    });

    expect(derived.get()).toBe(6);
    expect(derivedCallback).toHaveBeenCalledTimes(1);

    Cell.batch(() => {
      a.set(10);
      b.set(20);
      c.set(30);
    });

    expect(derived.get()).toBe(60);
    // Derived should only be recomputed once, not three times
    expect(derivedCallback).toHaveBeenCalledTimes(2);
  });

  test('Nested batch with error should not break outer batch', () => {
    const cell = Cell.source(1);
    const listener = vi.fn();
    cell.listen(listener);

    expect(() => {
      Cell.batch(() => {
        cell.set(10);

        try {
          Cell.batch(() => {
            cell.set(20);
            throw new Error('Inner batch error');
          });
        } catch (e) {
          // Catch the error from inner batch
        }

        cell.set(30);
      });
    }).not.toThrow();

    expect(listener).toHaveBeenCalled();
    expect(cell.get()).toBe(30);
  });

  test('Batch should preserve listener order (priority)', () => {
    const cell = Cell.source(0);
    let order = '';

    cell.listen(
      () => {
        order += 'C';
      },
      { priority: 1 },
    );
    cell.listen(
      () => {
        order += 'B';
      },
      { priority: 2 },
    );
    cell.listen(
      () => {
        order += 'A';
      },
      { priority: 3 },
    );

    Cell.batch(() => {
      cell.set(1);
      cell.set(2);
    });

    expect(order).toBe('ABC');
  });

  test('Batch with conditional derived cell updates', () => {
    const toggle = Cell.source(true);
    const a = Cell.source(1);
    const b = Cell.source(2);

    const derivedCallback = vi.fn();
    const derived = Cell.derived(() => {
      derivedCallback();
      return toggle.get() ? a.get() : b.get();
    });

    expect(derived.get()).toBe(1);
    expect(derivedCallback).toHaveBeenCalledTimes(1);

    // When toggle is true, changing `b` should not trigger derived recompuation
    Cell.batch(() => {
      b.set(20);
      b.set(30);
    });

    expect(derived.get()).toBe(1);
    expect(derivedCallback).toHaveBeenCalledTimes(1); // No additional computation

    // When we change toggle and a, derived should update once
    Cell.batch(() => {
      toggle.set(false);
      a.set(100);
      b.set(50);
    });

    expect(derived.get()).toBe(50);
    expect(derivedCallback).toHaveBeenCalledTimes(2);
  });

  test('Batch should handle setting same value multiple times with no-op', () => {
    const cell = Cell.source(5);
    const listener = vi.fn();
    cell.listen(listener);

    Cell.batch(() => {
      cell.set(10);
      cell.set(5); // Back to original value
    });

    // The listener should still be called because the value changed during the batch
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cell.get()).toBe(5);
  });
});

describe('Immediate effects', () => {
  test('Immediate effects should run immediately', () => {
    const callback = vi.fn();
    const cell = Cell.source(1);
    cell.runAndListen(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Immediate effects with once set to true should only run once', () => {
    const callback = vi.fn();
    const cell = Cell.source(1);
    cell.runAndListen(callback, { once: true });
    cell.set(2);
    cell.set(3);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Immediate effects with signals should be aborted', () => {
    const callback = vi.fn();
    const cell = Cell.source(1);
    const abortController = new AbortController();
    const signal = abortController.signal;
    cell.runAndListen(callback, { signal });
    abortController.abort();
    cell.set(2); // This should not trigger the callback
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('Cell.derivedAsync', () => {
  test('derived async cells should be created with sync callbacks', async () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const c = Cell.derived(() => a.get() * b.get());
    expect(c.get()).toBe(2);

    const d = Cell.derivedAsync((get) => {
      return get(c) * 3;
    });

    const e = Cell.derived(() => {
      return c.get() * c.get();
    });

    expect(await d.get()).toBe(6);
    expect(e.get()).toBe(4);

    a.set(9);
    expect(e.get()).toBe(324);
    expect(await d.get()).toBe(54);
  });

  test('derived async cells should be created with async callbacks', async () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const c = Cell.derivedAsync(async (get) => {
      await new Promise((resolve) => setTimeout(resolve));
      return get(a) * get(b);
    });
    const d = Cell.derived(() => {
      return a.get() * b.get() * b.get();
    });

    expect(await c.get()).toBe(2);
    expect(d.get()).toBe(4);
    a.set(7);
    expect(d.get()).toBe(28);
    expect(await c.get()).toBe(14);
  });

  test('pending state should transition correctly during async computation', async () => {
    const source = Cell.source(5);
    const asyncCell = Cell.derivedAsync(async (get) => {
      await new Promise((resolve) => setTimeout(resolve));
      return get(source) * 2;
    });

    expect(asyncCell.pending.get()).toBe(true);

    await asyncCell.get();
    expect(asyncCell.pending.get()).toBe(false);

    source.set(10);
    expect(asyncCell.pending.get()).toBe(true);

    await asyncCell.get();
    expect(asyncCell.pending.get()).toBe(false);
    expect(await asyncCell.get()).toBe(20);
  });

  test('error state should be set when async computation throws', async () => {
    const shouldError = Cell.source(false);
    const asyncCell = Cell.derivedAsync(async (get) => {
      if (get(shouldError)) {
        throw new Error('Async computation failed');
      }
      return 'success';
    });

    // Initially no error
    await asyncCell.get();
    expect(asyncCell.error.get()).toBe(null);

    // Trigger an error
    shouldError.set(true);
    await asyncCell.get();
    expect(asyncCell.error.get()).toBeInstanceOf(Error);
    expect(asyncCell.error.get()?.message).toBe('Async computation failed');

    // Error should clear on successful computation
    shouldError.set(false);
    await asyncCell.get();
    expect(asyncCell.error.get()).toBe(null);
  });

  test('should track multiple dependencies correctly', async () => {
    const a = Cell.source(2);
    const b = Cell.source(3);
    const c = Cell.source(4);
    const computeFn = vi.fn(async (get) => {
      await new Promise((resolve) => setTimeout(resolve));
      return get(a) + get(b) + get(c);
    });

    const asyncCell = Cell.derivedAsync(computeFn);
    expect(await asyncCell.get()).toBe(9);
    expect(computeFn).toHaveBeenCalledTimes(1);

    // Changing any dependency should trigger recomputation
    a.set(10);
    expect(await asyncCell.get()).toBe(17);
    expect(computeFn).toHaveBeenCalledTimes(2);

    b.set(20);
    expect(await asyncCell.get()).toBe(34);
    expect(computeFn).toHaveBeenCalledTimes(3);

    c.set(100);
    expect(await asyncCell.get()).toBe(130);
    expect(computeFn).toHaveBeenCalledTimes(4);
  });

  test('should handle rapid dependency changes', async () => {
    const source = Cell.source(0);
    const computeFn = vi.fn(async (get) => {
      await new Promise((resolve) => setTimeout(resolve));
      return get(source) * 2;
    });

    const asyncCell = Cell.derivedAsync(computeFn);

    // Rapidly change values
    source.set(1);
    source.set(2);
    source.set(3);
    source.set(4);
    source.set(5);

    // The final value should reflect the last source value
    expect(await asyncCell.get()).toBe(10);
  });

  test('should work with chained async derived cells', async () => {
    const source = Cell.source(5);

    const firstAsync = Cell.derivedAsync(async (get) => {
      await new Promise((resolve) => setTimeout(resolve));
      return get(source) * 2;
    });

    const secondAsync = Cell.derivedAsync(async (get) => {
      const firstValue = await get(firstAsync);
      await new Promise((resolve) => setTimeout(resolve));
      return firstValue + 100;
    });

    expect(await secondAsync.get()).toBe(110); // (5 * 2) + 100

    source.set(10);
    expect(await secondAsync.get()).toBe(120); // (10 * 2) + 100
  });

  test('should handle async computation returning different types', async () => {
    const mode = Cell.source('number');

    const asyncCell = Cell.derivedAsync(async (get) => {
      const currentMode = get(mode);
      await new Promise((resolve) => setTimeout(resolve));

      if (currentMode === 'number') return 42;
      if (currentMode === 'string') return 'hello';
      if (currentMode === 'object') return { key: 'value' };
      return null;
    });

    expect(await asyncCell.get()).toBe(42);

    mode.set('string');
    expect(await asyncCell.get()).toBe('hello');

    mode.set('object');
    expect(await asyncCell.get()).toEqual({ key: 'value' });

    mode.set('null');
    expect(await asyncCell.get()).toBe(null);
  });

  test('error cell should be listenable for error handling patterns', async () => {
    const shouldFail = Cell.source(false);
    const errorStates = [];

    const asyncCell = Cell.derivedAsync(async (get) => {
      if (get(shouldFail)) {
        throw new Error('Test failure');
      }
      return 'ok';
    });

    asyncCell.error.listen((err) => {
      errorStates.push(err);
    });

    await asyncCell.get();
    expect(errorStates.length).toBe(0);

    shouldFail.set(true);
    await asyncCell.get();

    expect(errorStates.some((e) => e instanceof Error)).toBe(true);
  });

  test('should work correctly with Cell.batch', async () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const computeFn = vi.fn(async (get) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return get(a) + get(b);
    });

    const asyncCell = Cell.derivedAsync(computeFn);
    expect(await asyncCell.get()).toBe(3);
    expect(computeFn).toHaveBeenCalledTimes(1);

    Cell.batch(() => {
      a.set(10);
      b.set(20);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await asyncCell.get()).toBe(30);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  test('should handle async computation that returns a promise', async () => {
    const source = Cell.source(7);

    const asyncCell = Cell.derivedAsync(async (get) => {
      const value = get(source);
      return Promise.resolve(value * 3);
    });

    expect(await asyncCell.get()).toBe(21);

    source.set(10);
    expect(await asyncCell.get()).toBe(30);
  });

  describe('Basic Lifecycle & State', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('pending transitions correctly during resolution', async () => {
      const asyncCell = Cell.derivedAsync(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'A';
      });

      expect(asyncCell.pending.get()).toBe(true);
      await vi.advanceTimersByTimeAsync(10);
      expect(await asyncCell.get()).toBe('A');
      expect(asyncCell.pending.get()).toBe(false);
      expect(asyncCell.error.get()).toBe(null);
    });

    test('pending flips on dependency update', async () => {
      const source = Cell.source(1);
      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 10));
        return val * 10;
      });

      await vi.advanceTimersByTimeAsync(10);
      expect(await asyncCell.get()).toBe(10);
      expect(asyncCell.pending.get()).toBe(false);

      source.set(2);
      expect(asyncCell.pending.get()).toBe(true);

      await vi.advanceTimersByTimeAsync(10);
      expect(asyncCell.pending.get()).toBe(false);
      expect(await asyncCell.get()).toBe(20);
    });

    test('handles non-async callback', async () => {
      const source = Cell.source(5);
      const asyncCell = Cell.derivedAsync((get) => get(source) * 2);

      await vi.advanceTimersByTimeAsync(0);
      expect(await asyncCell.get()).toBe(10);
      expect(asyncCell.pending.get()).toBe(false);
    });

    test('stores null and undefined correctly', async () => {
      const mode = Cell.source('null');
      const values = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        const m = get(mode);
        await new Promise((r) => setTimeout(r, 5));
        if (m === 'null') return null;
        if (m === 'undefined') return undefined;
        return 'value';
      });

      asyncCell.listen(async (promise) => values.push(await promise));

      await vi.advanceTimersByTimeAsync(5);
      expect(await asyncCell.get()).toBe(null);

      mode.set('undefined');
      await vi.advanceTimersByTimeAsync(5);
      expect(await asyncCell.get()).toBe(undefined);

      mode.set('value');
      await vi.advanceTimersByTimeAsync(5);
      expect(await asyncCell.get()).toBe('value');

      expect(values).toContain(undefined);
      expect(values).toContain('value');
    });
  });

  describe('Race Conditions', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('fast request overtakes slow request', async () => {
      const trigger = Cell.source('A');
      const values = [];
      let resolveA;
      let resolveB;

      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(trigger);
        if (val === 'A') {
          await new Promise((r) => {
            resolveA = r;
          });
          return 'A';
        }
        await new Promise((r) => {
          resolveB = r;
        });
        return 'B';
      });

      asyncCell.listen(async (p) => values.push(await p));
      await vi.advanceTimersByTimeAsync(10);

      trigger.set('B');
      await vi.advanceTimersByTimeAsync(10);

      resolveB();
      await vi.advanceTimersByTimeAsync(20);
      expect(await asyncCell.get()).toBe('B');

      resolveA();
      await vi.advanceTimersByTimeAsync(20);
      expect(await asyncCell.get()).toBe('B');
      expect(values.filter((v) => v === 'A').length).toBe(0);
    });

    test('rapid updates only commit final result', async () => {
      const trigger = Cell.source(0);
      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(trigger);
        await new Promise((r) => setTimeout(r, 30 - val * 5));
        return String.fromCharCode(65 + val);
      });

      trigger.set(0);
      trigger.set(1);
      trigger.set(2);
      await vi.advanceTimersByTimeAsync(100);

      expect(await asyncCell.get()).toBe('C');
    });

    test('stale error is ignored when success resolves first', async () => {
      const trigger = Cell.source('stable');
      let resolveA;
      let resolveB;

      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(trigger);
        if (val === 'error') {
          await new Promise((r) => {
            resolveA = r;
          });
          throw new Error('A failed');
        }
        if (val === 'success') {
          await new Promise((r) => {
            resolveB = r;
          });
          return 'New';
        }
        return 'Stable';
      });

      await vi.advanceTimersByTimeAsync(0);
      trigger.set('error');
      await vi.advanceTimersByTimeAsync(10);

      trigger.set('success');
      await vi.advanceTimersByTimeAsync(10);

      resolveB();
      await vi.advanceTimersByTimeAsync(20);
      expect(await asyncCell.get()).toBe('New');
      expect(asyncCell.error.get()).toBe(null);

      resolveA();
      await vi.advanceTimersByTimeAsync(20);
      expect(asyncCell.error.get()).toBe(null);
    });
  });

  describe('Equality Suppression', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('listeners do not fire for same primitive value', async () => {
      const trigger = Cell.source(false);
      const calls = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        get(trigger);
        await new Promise((r) => setTimeout(r, 10));
        return 42;
      });

      await vi.advanceTimersByTimeAsync(10);
      asyncCell.listen(async (p) => calls.push(await p));

      trigger.set(true);
      await vi.advanceTimersByTimeAsync(10);

      expect(calls.length).toBe(0);
    });

    test('listeners do not fire for deeply equal objects', async () => {
      const trigger = Cell.source(0);
      const calls = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        get(trigger);
        await new Promise((r) => setTimeout(r, 10));
        return { user: { id: 1 } };
      });

      await vi.advanceTimersByTimeAsync(10);
      asyncCell.listen(async (p) => calls.push(await p));

      trigger.set(1);
      await vi.advanceTimersByTimeAsync(10);

      expect(calls.length).toBe(0);
    });

    test('listeners fire for different arrays', async () => {
      const trigger = Cell.source(0);
      const calls = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(trigger);
        await new Promise((r) => setTimeout(r, 10));
        return val === 0 ? [1, 2] : [1, 2, 3];
      });

      await vi.advanceTimersByTimeAsync(10);
      asyncCell.listen(async (p) => calls.push(await p));

      trigger.set(1);
      await vi.advanceTimersByTimeAsync(10);

      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1]).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('error state is set and previous value preserved (SWR)', async () => {
      const shouldError = Cell.source(false);

      const asyncCell = Cell.derivedAsync(async (get) => {
        if (get(shouldError)) throw new Error('Computation failed');
        await new Promise((r) => setTimeout(r, 10));
        return 'valid';
      });

      await vi.advanceTimersByTimeAsync(10);
      expect(await asyncCell.get()).toBe('valid');

      shouldError.set(true);
      await vi.advanceTimersByTimeAsync(10);

      expect(asyncCell.error.get()).toBeInstanceOf(Error);
      expect(await asyncCell.get()).toBe('valid');
    });

    test('error clears on successful recovery', async () => {
      const shouldError = Cell.source(true);

      const asyncCell = Cell.derivedAsync(async (get) => {
        if (get(shouldError)) throw new Error('Failed');
        await new Promise((r) => setTimeout(r, 10));
        return 'recovered';
      });

      await vi.advanceTimersByTimeAsync(10);
      expect(asyncCell.error.get()).toBeInstanceOf(Error);

      shouldError.set(false);
      await vi.advanceTimersByTimeAsync(10);

      expect(asyncCell.error.get()).toBe(null);
      expect(await asyncCell.get()).toBe('recovered');
    });
  });

  describe('AbortSignal', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('signal is passed and initially not aborted', async () => {
      let capturedSignal = null;

      const asyncCell = Cell.derivedAsync(async (get, signal) => {
        capturedSignal = signal;
        await new Promise((r) => setTimeout(r, 10));
        return 'done';
      });

      await vi.advanceTimersByTimeAsync(10);
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(capturedSignal.aborted).toBe(false);
    });

    test('AbortError is handled gracefully', async () => {
      const trigger = Cell.source(1);

      const asyncCell = Cell.derivedAsync(async (get, signal) => {
        const val = get(trigger);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve(`Result ${val}`), 100);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        return `Result ${val}`;
      });

      asyncCell.get();
      await vi.advanceTimersByTimeAsync(10);
      trigger.set(2);
      await vi.advanceTimersByTimeAsync(150);

      expect(await asyncCell.get()).toBe('Result 2');
    });
  });

  describe('Chaining', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('async to async chaining works', async () => {
      const source = Cell.source(5);

      const asyncA = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(source) * 2;
      });

      const asyncB = Cell.derivedAsync(async (get) => {
        const aValue = await get(asyncA);
        await new Promise((r) => setTimeout(r, 20));
        return aValue + 100;
      });

      await vi.advanceTimersByTimeAsync(50);
      expect(await asyncB.get()).toBe(110);

      source.set(10);
      await vi.advanceTimersByTimeAsync(100);

      expect(await asyncA.get()).toBe(20);
      expect(await asyncB.get()).toBe(120);
    });

    test('intermediate results are discarded on rapid updates', async () => {
      const source = Cell.source(1);

      const asyncA = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 30));
        return val * 10;
      });

      const asyncB = Cell.derivedAsync(async (get) => {
        const aValue = await get(asyncA);
        await new Promise((r) => setTimeout(r, 10));
        return aValue + 1;
      });

      await vi.advanceTimersByTimeAsync(40);
      const triggered = [];
      asyncB.listen(async (value) => {
        triggered.push(await value);
      });

      source.set(1);
      source.set(-10);
      source.set(88);
      source.set(2);
      await vi.advanceTimersByTimeAsync(40);

      expect(await asyncA.get()).toBe(20);
      expect(await asyncB.get()).toBe(21);
      expect(triggered).toEqual([21]);
    });

    test('deep chain (A -> B -> C -> D) stays consistent', async () => {
      const source = Cell.source(1);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return val + 10;
      });

      const c = Cell.derivedAsync(async (get) => {
        const val = await get(b);
        await new Promise((r) => setTimeout(r, 10));
        return val * 3;
      });

      const d = Cell.derivedAsync(async (get) => {
        const val = await get(c);
        await new Promise((r) => setTimeout(r, 10));
        return val - 5;
      });

      await vi.advanceTimersByTimeAsync(50);
      expect(await d.get()).toBe(31); // ((1*2)+10)*3 - 5 = 31

      source.set(5);
      await vi.advanceTimersByTimeAsync(50);

      expect(await a.get()).toBe(10);
      expect(await b.get()).toBe(20);
      expect(await c.get()).toBe(60);
      expect(await d.get()).toBe(55);
    });

    test('diamond dependency (A -> B, A -> C, B+C -> D) resolves correctly', async () => {
      const source = Cell.source(2);

      const a = Cell.derivedAsync(async (get) => {
        console.log('\nderiving a');
        await new Promise((r) => setTimeout(r, 10));
        return get(source);
      });

      const b = Cell.derivedAsync(async (get) => {
        console.log('deriving b');
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 15));
        return val * 10;
      });

      const c = Cell.derivedAsync(async (get) => {
        console.log('deriving c');
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 5));
        return val + 100;
      });

      const d = Cell.derivedAsync(async (get) => {
        const bVal = await get(b);
        const cVal = await get(c);
        console.log('deriving d');
        await new Promise((r) => setTimeout(r, 10));
        return bVal + cVal;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(await d.get()).toBe(122);

      source.set(5);
      await vi.advanceTimersByTimeAsync(100);

      expect(await a.get()).toBe(5);
      expect(await b.get()).toBe(50);
      expect(await c.get()).toBe(105);
      expect(await d.get()).toBe(155);

      source.set(10);
      source.set(11);
      await vi.advanceTimersByTimeAsync(100);

      expect(await a.get()).toBe(11);
      expect(await b.get()).toBe(110);
      expect(await c.get()).toBe(111);
      expect(await d.get()).toBe(221);
    });

    test('downstream async derived is not restarted when a slower upstream dependency settles later', async () => {
      const source = Cell.source(2);

      const a = Cell.derivedAsync(async (get) => {
        await delay(10);
        return get(source);
      });

      const b = Cell.derivedAsync(async (get) => {
        const val = await get(a);
        await delay(15);
        return val * 10;
      });

      const c = Cell.derivedAsync(async (get) => {
        const val = await get(a);
        await delay(5);
        return val + 100;
      });

      const dRuns = vi.fn();
      const d = Cell.derivedAsync(async (get) => {
        dRuns(); // counts "deriving d"
        const bVal = await get(b);
        const cVal = await get(c);
        await delay(10);
        return bVal + cVal;
      });

      // Let initial computation settle
      await vi.advanceTimersByTimeAsync(100);
      expect(await d.get()).toBe(122);

      // Measure only runs caused by the next source update
      dRuns.mockClear();

      source.set(5);

      // c completes at ~15ms after the set (a:10ms + c:5ms), so d should start once here
      await vi.advanceTimersByTimeAsync(14);
      expect(dRuns).toHaveBeenCalledTimes(0);

      await vi.advanceTimersByTimeAsync(2);
      expect(dRuns).toHaveBeenCalledTimes(1);
      expect(d.pending.peek()).toBe(true); // d is running, waiting on b

      // b completes at ~25ms after the set (a:10ms + b:15ms).
      // d must NOT restart when b settles later.
      await vi.advanceTimersByTimeAsync(10); // total advanced since set: 26ms
      expect(dRuns).toHaveBeenCalledTimes(1);

      // Finish everything
      await vi.advanceTimersByTimeAsync(50);
      expect(await d.get()).toBe(155);
      expect(dRuns).toHaveBeenCalledTimes(1);
    });

    test('error in chain propagates but does not corrupt state', async () => {
      const source = Cell.source(1);
      const shouldError = Cell.source(false);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        if (get(shouldError)) throw new Error('A failed');
        return get(source) * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return val + 100;
      });

      await vi.advanceTimersByTimeAsync(30);
      expect(await b.get()).toBe(102);
      expect(b.error.get()).toBe(null);

      shouldError.set(true);
      await vi.advanceTimersByTimeAsync(30);

      expect(a.error.get()).toBeInstanceOf(Error);
      expect(await a.get()).toBe(2); // stale value preserved

      shouldError.set(false);
      source.set(10);
      await vi.advanceTimersByTimeAsync(30);

      expect(a.error.get()).toBe(null);
      expect(await a.get()).toBe(20);
      expect(await b.get()).toBe(120);
    });

    test('listeners across chain all fire with correct final values', async () => {
      const source = Cell.source(1);
      const aValues = [];
      const bValues = [];

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return val + 50;
      });

      await vi.advanceTimersByTimeAsync(30);
      a.listen(async (p) => aValues.push(await p));
      b.listen(async (p) => bValues.push(await p));

      source.set(5);
      await vi.advanceTimersByTimeAsync(30);

      source.set(10);
      await vi.advanceTimersByTimeAsync(30);

      expect(aValues).toEqual([10, 20]);
      expect(bValues).toEqual([60, 70]);
    });

    test('sync cell feeding async chain works correctly', async () => {
      const source = Cell.source(3);
      const syncDerived = Cell.derived(() => source.get() * 2);

      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(syncDerived);
        await new Promise((r) => setTimeout(r, 10));
        return val + 100;
      });

      await vi.advanceTimersByTimeAsync(10);
      expect(await asyncCell.get()).toBe(106);

      source.set(7);
      await vi.advanceTimersByTimeAsync(10);

      expect(syncDerived.get()).toBe(14);
      expect(await asyncCell.get()).toBe(114);
    });

    test('batched update through chain triggers single recomputation per cell', async () => {
      const s1 = Cell.source(1);
      const s2 = Cell.source(2);
      const computeA = vi.fn(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(s1) + get(s2);
      });
      const computeB = vi.fn(async (get) => {
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return val * 2;
      });

      const a = Cell.derivedAsync(computeA);
      const b = Cell.derivedAsync(computeB);

      await vi.advanceTimersByTimeAsync(30);
      expect(computeA).toHaveBeenCalledTimes(1);
      expect(computeB).toHaveBeenCalledTimes(1);
      expect(await b.get()).toBe(6);

      Cell.batch(() => {
        s1.set(10);
        s2.set(20);
      });

      await vi.advanceTimersByTimeAsync(30);
      expect(computeA).toHaveBeenCalledTimes(2);
      expect(computeB).toHaveBeenCalledTimes(2);
      expect(await a.get()).toBe(30);
      expect(await b.get()).toBe(60);
    });

    test('rapid interruptions with many concurrent updates do not leave stuck promises', async () => {
      const source = Cell.source(0);

      const a = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 50));
        return val * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 30));
        return aVal + 100;
      });

      const c = Cell.derivedAsync(async (get) => {
        const bVal = await get(b);
        await new Promise((r) => setTimeout(r, 20));
        return bVal * 3;
      });

      // Initial computation
      await vi.advanceTimersByTimeAsync(150);
      expect(await c.get()).toBe(300); // ((0*2)+100)*3 = 300

      // Rapid fire updates - none should complete except the final
      source.set(1);
      await vi.advanceTimersByTimeAsync(10);
      source.set(2);
      await vi.advanceTimersByTimeAsync(10);
      source.set(3);
      await vi.advanceTimersByTimeAsync(10);
      source.set(4);
      await vi.advanceTimersByTimeAsync(10);
      source.set(5);

      // Let everything settle
      await vi.advanceTimersByTimeAsync(200);

      // System should have final correct values
      expect(await a.get()).toBe(10);
      expect(await b.get()).toBe(110);
      expect(await c.get()).toBe(330);
      expect(a.pending.get()).toBe(false);
      expect(b.pending.get()).toBe(false);
      expect(c.pending.get()).toBe(false);
    });

    test('multiple async parents changing concurrently resolve correctly', async () => {
      const source1 = Cell.source(1);
      const source2 = Cell.source(100);

      const parentA = Cell.derivedAsync(async (get) => {
        const val = get(source1);
        await new Promise((r) => setTimeout(r, 30));
        return val * 10;
      });

      const parentB = Cell.derivedAsync(async (get) => {
        const val = get(source2);
        await new Promise((r) => setTimeout(r, 20));
        return val + 5;
      });

      const child = Cell.derivedAsync(async (get) => {
        const aVal = await get(parentA);
        const bVal = await get(parentB);
        await new Promise((r) => setTimeout(r, 10));
        return aVal + bVal;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(await child.get()).toBe(115); // (1*10) + (100+5)

      // Update both parents simultaneously
      source1.set(5);
      source2.set(200);

      await vi.advanceTimersByTimeAsync(100);

      expect(await parentA.get()).toBe(50);
      expect(await parentB.get()).toBe(205);
      expect(await child.get()).toBe(255);
    });

    test('system never gets stuck when parent is interrupted mid-flight', async () => {
      const source = Cell.source('initial');

      const parent = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 100));
        return `processed:${val}`;
      });

      const child = Cell.derivedAsync(async (get) => {
        const parentVal = await get(parent);
        await new Promise((r) => setTimeout(r, 50));
        return `child:${parentVal}`;
      });

      // Start initial computation
      await vi.advanceTimersByTimeAsync(30);

      // Interrupt mid-flight - parent is still computing
      source.set('update1');
      await vi.advanceTimersByTimeAsync(30);

      // Interrupt again
      source.set('update2');

      // Wait for everything to resolve
      await vi.advanceTimersByTimeAsync(300);

      // System must not be stuck
      expect(parent.pending.get()).toBe(false);
      expect(child.pending.get()).toBe(false);
      expect(await parent.get()).toBe('processed:update2');
      expect(await child.get()).toBe('child:processed:update2');
    });

    test('async derived cell is not recomputed if async source resolves to same value', async () => {
      const trigger = Cell.source(0);
      const computeParent = vi.fn();
      const computeChild = vi.fn();

      const parent = Cell.derivedAsync(async (get) => {
        const val = get(trigger);
        computeParent();
        await new Promise((r) => setTimeout(r, 20));
        // Always returns the same value regardless of trigger
        return 'constant';
      });

      const child = Cell.derivedAsync(async (get) => {
        const parentVal = await get(parent);
        computeChild();
        await new Promise((r) => setTimeout(r, 20));
        return `child:${parentVal}`;
      });

      await vi.advanceTimersByTimeAsync(50);
      expect(computeParent).toHaveBeenCalledTimes(1);
      expect(computeChild).toHaveBeenCalledTimes(1);
      expect(await child.get()).toBe('child:constant');

      // Update trigger - parent recomputes but returns same value
      trigger.set(1);
      await vi.advanceTimersByTimeAsync(50);

      expect(computeParent).toHaveBeenCalledTimes(2); // Parent recomputed
      expect(computeChild).toHaveBeenCalledTimes(1); // Child should NOT recompute
      expect(await child.get()).toBe('child:constant');

      // Update trigger again
      trigger.set(2);
      await vi.advanceTimersByTimeAsync(50);

      expect(computeParent).toHaveBeenCalledTimes(3);
      expect(computeChild).toHaveBeenCalledTimes(1); // Still no recomputation
    });

    test('deeply nested chain with async sources that dont change skips child recomputation', async () => {
      // Start with source=10, so a=min(10,10)=10
      const source = Cell.source(10);
      const computeA = vi.fn();
      const computeB = vi.fn();
      const computeC = vi.fn();

      const a = Cell.derivedAsync(async (get) => {
        computeA();
        const val = get(source);
        await new Promise((r) => setTimeout(r, 10));
        // Normalize values above 10 to 10
        return Math.min(val, 10);
      });

      const b = Cell.derivedAsync(async (get) => {
        computeB();
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return aVal * 2;
      });

      const c = Cell.derivedAsync(async (get) => {
        computeC();
        const bVal = await get(b);
        await new Promise((r) => setTimeout(r, 10));
        return bVal + 1;
      });

      await vi.advanceTimersByTimeAsync(50);
      expect(await c.get()).toBe(21); // min(10,10)*2+1 = 21
      expect(computeA).toHaveBeenCalledTimes(1);
      expect(computeB).toHaveBeenCalledTimes(1);
      expect(computeC).toHaveBeenCalledTimes(1);

      // Change source to 15, but a still returns 10 (min(15,10)=10)
      source.set(15);
      await vi.advanceTimersByTimeAsync(50);

      expect(computeA).toHaveBeenCalledTimes(2);
      expect(computeB).toHaveBeenCalledTimes(1); // No change from a's value
      expect(computeC).toHaveBeenCalledTimes(1);
      expect(await c.get()).toBe(21);

      // Change source to 5, now a returns 5 (min(5,10)=5) - different!
      source.set(5);
      await vi.advanceTimersByTimeAsync(50);

      expect(computeA).toHaveBeenCalledTimes(3);
      expect(computeB).toHaveBeenCalledTimes(2); // Now recomputes
      expect(computeC).toHaveBeenCalledTimes(2);
      expect(await c.get()).toBe(11); // min(5,10)*2+1 = 11
    });

    test('consistency during stress test with interleaved async completions', async () => {
      const fast = Cell.source(1);
      const medium = Cell.source(10);
      const slow = Cell.source(100);

      const asyncFast = Cell.derivedAsync(async (get) => {
        const val = get(fast);
        await new Promise((r) => setTimeout(r, 10));
        return val;
      });

      const asyncMedium = Cell.derivedAsync(async (get) => {
        const val = get(medium);
        await new Promise((r) => setTimeout(r, 25));
        return val;
      });

      const asyncSlow = Cell.derivedAsync(async (get) => {
        const val = get(slow);
        await new Promise((r) => setTimeout(r, 50));
        return val;
      });

      const combined = Cell.derivedAsync(async (get) => {
        const f = await get(asyncFast);
        const m = await get(asyncMedium);
        const s = await get(asyncSlow);
        await new Promise((r) => setTimeout(r, 5));
        return f + m + s;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(await combined.get()).toBe(111);

      // Update all at different times
      fast.set(2);
      await vi.advanceTimersByTimeAsync(5);
      medium.set(20);
      await vi.advanceTimersByTimeAsync(5);
      slow.set(200);

      // Wait for everything
      await vi.advanceTimersByTimeAsync(200);

      // System must have final consistent values
      expect(await asyncFast.get()).toBe(2);
      expect(await asyncMedium.get()).toBe(20);
      expect(await asyncSlow.get()).toBe(200);
      expect(await combined.get()).toBe(222);
    });

    test('discarded promise does not affect later computations', async () => {
      const source = Cell.source(1);
      const values = [];

      const asyncCell = Cell.derivedAsync(async (get, signal) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 40));
        if (signal.aborted) return;
        values.push(val);
        return val * 10;
      });

      const downstream = Cell.derivedAsync(async (get) => {
        const val = await get(asyncCell);
        await new Promise((r) => setTimeout(r, 20));
        return val + 1;
      });

      await vi.advanceTimersByTimeAsync(70);
      expect(values).toEqual([1]);
      expect(await downstream.get()).toBe(11);

      // Rapid updates - intermediate should be discarded
      source.set(2);
      await vi.advanceTimersByTimeAsync(20);
      source.set(3);

      await vi.advanceTimersByTimeAsync(100);

      // Only the final value should be recorded
      expect(values).toEqual([1, 3]);
      expect(await asyncCell.get()).toBe(30);
      expect(await downstream.get()).toBe(31);
    });

    test('reading async cell at any point gives correct value', async () => {
      const source = Cell.source(1);

      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 30));
        return val * 100;
      });

      // Read immediately - should wait for resolution
      const promise1 = asyncCell.get();
      await vi.advanceTimersByTimeAsync(35);
      expect(await promise1).toBe(100);

      source.set(2);

      // Read mid-computation
      await vi.advanceTimersByTimeAsync(10);
      const promise2 = asyncCell.get();

      await vi.advanceTimersByTimeAsync(25);
      expect(await promise2).toBe(200);

      // Read after completion
      const promise3 = asyncCell.get();
      expect(await promise3).toBe(200);
    });

    test('child async cell handles parent error gracefully without getting stuck', async () => {
      const source = Cell.source(0);

      const parent = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 20));
        if (val === 1) throw new Error('Parent error');
        return val * 10;
      });

      const child = Cell.derivedAsync(async (get) => {
        const parentVal = await get(parent);
        await new Promise((r) => setTimeout(r, 20));
        return parentVal + 5;
      });

      await vi.advanceTimersByTimeAsync(50);
      expect(await child.get()).toBe(5);

      // Trigger error
      source.set(1);
      await vi.advanceTimersByTimeAsync(50);

      expect(parent.error.get()).toBeInstanceOf(Error);
      expect(parent.pending.get()).toBe(false);
      expect(child.pending.get()).toBe(false);

      // Recover
      source.set(2);
      await vi.advanceTimersByTimeAsync(50);

      expect(parent.error.get()).toBe(null);
      expect(await parent.get()).toBe(20);
      expect(await child.get()).toBe(25);
    });

    test('complex diamond with async at all levels stays consistent', async () => {
      const source = Cell.source(1);

      //          source
      //            |
      //          async1
      //          /    \
      //     async2   async3
      //          \    /
      //          async4

      const async1 = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 2;
      });

      const async2 = Cell.derivedAsync(async (get) => {
        const val = await get(async1);
        await new Promise((r) => setTimeout(r, 15));
        return val + 10;
      });

      const async3 = Cell.derivedAsync(async (get) => {
        const val = await get(async1);
        await new Promise((r) => setTimeout(r, 25));
        return val + 20;
      });

      const async4 = Cell.derivedAsync(async (get) => {
        const v2 = await get(async2);
        const v3 = await get(async3);
        await new Promise((r) => setTimeout(r, 10));
        return v2 + v3;
      });

      await vi.advanceTimersByTimeAsync(100);
      // source=1 => async1=2 => async2=12, async3=22 => async4=34
      expect(await async4.get()).toBe(34);

      // Rapid updates
      source.set(5);
      await vi.advanceTimersByTimeAsync(10);
      source.set(10);

      await vi.advanceTimersByTimeAsync(150);

      // source=10 => async1=20 => async2=30, async3=40 => async4=70
      expect(await async1.get()).toBe(20);
      expect(await async2.get()).toBe(30);
      expect(await async3.get()).toBe(40);
      expect(await async4.get()).toBe(70);
    });

    test('sync derived feeding into async chain with interruptions', async () => {
      const source = Cell.source(1);
      const syncDerived = Cell.derived(() => source.get() * 3);
      const computeAsync = vi.fn();

      const asyncCell = Cell.derivedAsync(async (get) => {
        computeAsync();
        const val = get(syncDerived);
        await new Promise((r) => setTimeout(r, 30));
        return val + 100;
      });

      await vi.advanceTimersByTimeAsync(40);
      expect(await asyncCell.get()).toBe(103);
      expect(computeAsync).toHaveBeenCalledTimes(1);

      // Rapid sync updates cascade to async
      source.set(2);
      await vi.advanceTimersByTimeAsync(10);
      source.set(3);
      await vi.advanceTimersByTimeAsync(10);
      source.set(4);

      await vi.advanceTimersByTimeAsync(50);

      expect(syncDerived.get()).toBe(12);
      expect(await asyncCell.get()).toBe(112);
    });

    test('multiple reads of async cell during computation all resolve to correct value', async () => {
      const source = Cell.source(1);

      const asyncCell = Cell.derivedAsync(async (get) => {
        const val = get(source);
        await new Promise((r) => setTimeout(r, 50));
        return val * 10;
      });

      // Start multiple reads during computation
      const reads = [];
      for (let i = 0; i < 5; i++) {
        reads.push(asyncCell.get());
        await vi.advanceTimersByTimeAsync(5);
      }

      await vi.advanceTimersByTimeAsync(60);

      // All reads should resolve to the same correct value
      const results = await Promise.all(reads);
      expect(results).toEqual([10, 10, 10, 10, 10]);
    });

    test('pending state is always accurate during transitions', async () => {
      const source = Cell.source(1);
      const pendingStates = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 30));
        return get(source) * 10;
      });

      // Use runAndListen to capture initial state and all future states
      asyncCell.pending.runAndListen((p) => pendingStates.push(p));

      // Initial state should be true (still computing)
      expect(pendingStates).toEqual([true]);

      await vi.advanceTimersByTimeAsync(40);
      // After initial computation completes, pending goes to false
      expect(pendingStates).toEqual([true, false]);

      source.set(2);
      // Immediately after update, pending should be true
      expect(asyncCell.pending.get()).toBe(true);

      await vi.advanceTimersByTimeAsync(40);
      expect(asyncCell.pending.get()).toBe(false);
      // Full cycle: true (initial) -> false (done) -> true (recomputing) -> false (done)
      expect(pendingStates).toEqual([true, false, true, false]);
    });

    test('very deep chain (6 levels) stays consistent with interruptions', async () => {
      const source = Cell.source(1);
      const computeCounts = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };

      const a = Cell.derivedAsync(async (get) => {
        computeCounts.a++;
        await new Promise((r) => setTimeout(r, 5));
        return get(source) * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        computeCounts.b++;
        const val = await get(a);
        await new Promise((r) => setTimeout(r, 5));
        return val + 10;
      });

      const c = Cell.derivedAsync(async (get) => {
        computeCounts.c++;
        const val = await get(b);
        await new Promise((r) => setTimeout(r, 5));
        return val * 3;
      });

      const d = Cell.derivedAsync(async (get) => {
        computeCounts.d++;
        const val = await get(c);
        await new Promise((r) => setTimeout(r, 5));
        return val - 5;
      });

      const e = Cell.derivedAsync(async (get) => {
        computeCounts.e++;
        const val = await get(d);
        await new Promise((r) => setTimeout(r, 5));
        return val / 2;
      });

      const f = Cell.derivedAsync(async (get) => {
        computeCounts.f++;
        const val = await get(e);
        await new Promise((r) => setTimeout(r, 5));
        return Math.round(val);
      });

      // Initial computation
      await vi.advanceTimersByTimeAsync(100);
      // source=1 -> a=2 -> b=12 -> c=36 -> d=31 -> e=15.5 -> f=16
      expect(await f.get()).toBe(16);
      expect(Object.values(computeCounts).every((c) => c === 1)).toBe(true);

      // Rapid interruptions
      source.set(2);
      await vi.advanceTimersByTimeAsync(3);
      source.set(3);
      await vi.advanceTimersByTimeAsync(3);
      source.set(4);

      await vi.advanceTimersByTimeAsync(100);

      // source=4 -> a=8 -> b=18 -> c=54 -> d=49 -> e=24.5 -> f=25
      expect(await f.get()).toBe(25);
      // Each cell should have computed once for initial + once for final
      expect(computeCounts.a).toBe(4); // Restarted 3 times
      expect(computeCounts.f).toBe(2); // Only computed twice (initial + final)
    });

    test('concurrent interruptions at different chain levels', async () => {
      const source1 = Cell.source(1);
      const source2 = Cell.source(100);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(source1) * 10;
      });

      const b = Cell.derivedAsync(async (get) => {
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 20));
        return aVal + get(source2);
      });

      const c = Cell.derivedAsync(async (get) => {
        const bVal = await get(b);
        await new Promise((r) => setTimeout(r, 20));
        return bVal * 2;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(await c.get()).toBe(220); // ((1*10)+100)*2

      // Change both sources at different times
      source1.set(2);
      await vi.advanceTimersByTimeAsync(10);
      source2.set(200);
      await vi.advanceTimersByTimeAsync(10);
      source1.set(3);

      await vi.advanceTimersByTimeAsync(150);

      // Final state should reflect last values
      expect(await a.get()).toBe(30);
      expect(await b.get()).toBe(230);
      expect(await c.get()).toBe(460);
    });

    test('mixed sync and async cells in chain with interruptions', async () => {
      const source = Cell.source(1);
      const syncComputeCount = { value: 0 };

      const async1 = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(source) * 2;
      });

      // Sync derived in the middle
      const sync1 = Cell.derived(() => {
        syncComputeCount.value++;
        return async1.peek() !== null ? 100 : 0;
      });

      const async2 = Cell.derivedAsync(async (get) => {
        const a1 = await get(async1);
        const s1 = get(sync1);
        await new Promise((r) => setTimeout(r, 20));
        return a1 + s1;
      });

      await vi.advanceTimersByTimeAsync(60);
      expect(await async2.get()).toBe(102); // 2 + 100

      source.set(5);
      await vi.advanceTimersByTimeAsync(60);

      expect(await async1.get()).toBe(10);
      expect(await async2.get()).toBe(110); // 10 + 100
    });

    test('stale closure prevention - computation uses latest values', async () => {
      const source = Cell.source('initial');
      const capturedValues = [];

      const asyncCell = Cell.derivedAsync(async (get, signal) => {
        const val = get(source);
        capturedValues.push(`start:${val}`);
        await new Promise((r) => setTimeout(r, 30));
        if (signal.aborted) return null;
        capturedValues.push(`end:${val}`);
        return val;
      });

      await vi.advanceTimersByTimeAsync(40);
      expect(capturedValues).toEqual(['start:initial', 'end:initial']);

      // Rapid updates - only final should complete
      capturedValues.length = 0;
      source.set('update1');
      await vi.advanceTimersByTimeAsync(10);
      source.set('update2');
      await vi.advanceTimersByTimeAsync(10);
      source.set('final');

      await vi.advanceTimersByTimeAsync(50);

      // Should show starts for all, but only end for final
      expect(capturedValues).toContain('start:update1');
      expect(capturedValues).toContain('start:update2');
      expect(capturedValues).toContain('start:final');
      expect(capturedValues).toContain('end:final');
      expect(capturedValues).not.toContain('end:update1');
      expect(capturedValues).not.toContain('end:update2');
      expect(await asyncCell.get()).toBe('final');
    });

    test('multiple independent async sources feeding same child', async () => {
      const src1 = Cell.source(1);
      const src2 = Cell.source(10);
      const src3 = Cell.source(100);

      const async1 = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(src1);
      });

      const async2 = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(src2);
      });

      const async3 = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 30));
        return get(src3);
      });

      const combined = Cell.derivedAsync(async (get) => {
        const v1 = await get(async1);
        const v2 = await get(async2);
        const v3 = await get(async3);
        return v1 + v2 + v3;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(await combined.get()).toBe(111);

      // Update all three simultaneously
      src1.set(2);
      src2.set(20);
      src3.set(200);

      await vi.advanceTimersByTimeAsync(100);
      expect(await combined.get()).toBe(222);
    });

    test('cascade of rapid changes produces correct final state', async () => {
      const source = Cell.source(0);
      const values = [];

      const a = Cell.derivedAsync(async (get) => {
        const v = get(source);
        await new Promise((r) => setTimeout(r, 15));
        return v * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const v = await get(a);
        await new Promise((r) => setTimeout(r, 15));
        return v + 1;
      });

      b.listen(async (p) => {
        values.push(await p);
      });

      await vi.advanceTimersByTimeAsync(50);

      // 10 rapid changes
      for (let i = 1; i <= 10; i++) {
        source.set(i);
        await vi.advanceTimersByTimeAsync(5);
      }

      await vi.advanceTimersByTimeAsync(100);

      // Final value should be correct
      expect(await b.get()).toBe(21); // 10*2+1
      // Listener should have received the final value
      expect(values[values.length - 1]).toBe(21);
    });

    test('error recovery maintains correct chain dependencies', async () => {
      const source = Cell.source(1);
      const shouldFail = Cell.source(false);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        if (get(shouldFail)) throw new Error('A failed');
        return get(source) * 10;
      });

      const b = Cell.derivedAsync(async (get) => {
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return aVal + 5;
      });

      const c = Cell.derivedAsync(async (get) => {
        const bVal = await get(b);
        await new Promise((r) => setTimeout(r, 10));
        return bVal * 2;
      });

      await vi.advanceTimersByTimeAsync(50);
      expect(await c.get()).toBe(30); // ((1*10)+5)*2

      // Trigger error
      shouldFail.set(true);
      await vi.advanceTimersByTimeAsync(50);
      expect(a.error.get()).toBeInstanceOf(Error);

      // Recover
      shouldFail.set(false);
      source.set(2);
      await vi.advanceTimersByTimeAsync(50);

      expect(a.error.get()).toBe(null);
      expect(await a.get()).toBe(20);
      expect(await b.get()).toBe(25);
      expect(await c.get()).toBe(50);
    });

    test('reading at various points during recomputation always gives valid value', async () => {
      const source = Cell.source(1);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 30));
        return get(source) * 10;
      });

      const b = Cell.derivedAsync(async (get) => {
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 30));
        return aVal + 100;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(await b.get()).toBe(110);

      source.set(2);

      // Check states at various points during recomputation using peek()
      // peek() returns current internal value without waiting
      const states = [];
      for (let t = 0; t < 80; t += 10) {
        await vi.advanceTimersByTimeAsync(10);
        const pending = b.pending.get();
        // Use peek() to get current value without blocking
        const currentValue = pending ? null : await b.wvalue;
        states.push({ pending, value: currentValue });
      }

      // Should see some pending states during recomputation
      expect(states.some((s) => s.pending)).toBe(true);
      // Should see the computation complete
      expect(states.some((s) => !s.pending)).toBe(true);

      // Final value should be correct
      expect(await b.get()).toBe(120);
    });

    test('listeners at every level fire with correct values', async () => {
      const source = Cell.source(1);
      const aValues = [];
      const bValues = [];
      const cValues = [];

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 10));
        return aVal + 10;
      });

      const c = Cell.derivedAsync(async (get) => {
        const bVal = await get(b);
        await new Promise((r) => setTimeout(r, 10));
        return bVal * 3;
      });

      await vi.advanceTimersByTimeAsync(50);
      a.listen(async (p) => aValues.push(await p));
      b.listen(async (p) => bValues.push(await p));
      c.listen(async (p) => cValues.push(await p));

      source.set(5);
      await vi.advanceTimersByTimeAsync(50);

      source.set(10);
      await vi.advanceTimersByTimeAsync(50);

      expect(aValues).toEqual([10, 20]);
      expect(bValues).toEqual([20, 30]);
      expect(cValues).toEqual([60, 90]);
    });

    test('async cell with no async dependencies behaves correctly', async () => {
      const source = Cell.source(5);
      const computeCount = { value: 0 };

      const asyncCell = Cell.derivedAsync(async (get) => {
        computeCount.value++;
        const val = get(source);
        await new Promise((r) => setTimeout(r, 20));
        return val * val;
      });

      await vi.advanceTimersByTimeAsync(30);
      expect(await asyncCell.get()).toBe(25);
      expect(computeCount.value).toBe(1);

      source.set(10);
      await vi.advanceTimersByTimeAsync(30);

      expect(await asyncCell.get()).toBe(100);
      expect(computeCount.value).toBe(2);
    });

    test('deeply nested diamond pattern resolves correctly', async () => {
      const source = Cell.source(1);

      //         source
      //           |
      //          L1
      //         /  \
      //       L2A  L2B
      //         \  /
      //          L3
      //         /  \
      //       L4A  L4B
      //         \  /
      //          L5

      const L1 = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 5));
        return get(source);
      });

      const L2A = Cell.derivedAsync(async (get) => {
        const v = await get(L1);
        await new Promise((r) => setTimeout(r, 5));
        return v * 10;
      });

      const L2B = Cell.derivedAsync(async (get) => {
        const v = await get(L1);
        await new Promise((r) => setTimeout(r, 10));
        return v + 100;
      });

      const L3 = Cell.derivedAsync(async (get) => {
        const a = await get(L2A);
        const b = await get(L2B);
        await new Promise((r) => setTimeout(r, 5));
        return a + b;
      });

      const L4A = Cell.derivedAsync(async (get) => {
        const v = await get(L3);
        await new Promise((r) => setTimeout(r, 5));
        return v * 2;
      });

      const L4B = Cell.derivedAsync(async (get) => {
        const v = await get(L3);
        await new Promise((r) => setTimeout(r, 10));
        return v - 50;
      });

      const L5 = Cell.derivedAsync(async (get) => {
        const a = await get(L4A);
        const b = await get(L4B);
        await new Promise((r) => setTimeout(r, 5));
        return a + b;
      });

      await vi.advanceTimersByTimeAsync(100);
      // L1=1, L2A=10, L2B=101, L3=111, L4A=222, L4B=61, L5=283
      expect(await L5.get()).toBe(283);

      source.set(5);
      await vi.advanceTimersByTimeAsync(100);
      // L1=5, L2A=50, L2B=105, L3=155, L4A=310, L4B=105, L5=415
      expect(await L5.get()).toBe(415);
    });

    test('pending states propagate correctly through entire chain', async () => {
      const source = Cell.source(1);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(source);
      });

      const b = Cell.derivedAsync(async (get) => {
        const v = await get(a);
        await new Promise((r) => setTimeout(r, 20));
        return v * 2;
      });

      const c = Cell.derivedAsync(async (get) => {
        const v = await get(b);
        await new Promise((r) => setTimeout(r, 20));
        return v + 100;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(a.pending.get()).toBe(false);
      expect(b.pending.get()).toBe(false);
      expect(c.pending.get()).toBe(false);

      source.set(10);

      // Immediately after, a should be pending
      expect(a.pending.get()).toBe(true);

      await vi.advanceTimersByTimeAsync(25);
      // a done, b should be pending
      expect(a.pending.get()).toBe(false);
      expect(b.pending.get()).toBe(true);

      await vi.advanceTimersByTimeAsync(25);
      // b done, c should be pending
      expect(b.pending.get()).toBe(false);
      expect(c.pending.get()).toBe(true);

      await vi.advanceTimersByTimeAsync(25);
      // all done
      expect(c.pending.get()).toBe(false);
      expect(await c.get()).toBe(120);
    });

    test('peek() returns same value as get() without registering dependencies', async () => {
      const source = Cell.source(5);

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(source) * 10;
      });

      await vi.advanceTimersByTimeAsync(30);

      // Both should return the same value
      expect(await asyncCell.get()).toBe(50);
      expect(await asyncCell.peek()).toBe(50);

      source.set(10);
      await vi.advanceTimersByTimeAsync(30);

      expect(await asyncCell.get()).toBe(100);
      expect(await asyncCell.peek()).toBe(100);
    });

    test('peek() does not register dependency in derived cell', async () => {
      const source = Cell.source(1);
      let derivedComputeCount = 0;

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 10;
      });

      // A derived cell that uses peek() instead of get()
      const derivedWithPeek = Cell.derived(() => {
        derivedComputeCount++;
        // Using peek() should NOT register a dependency
        const val = asyncCell.peek();
        return val;
      });

      await vi.advanceTimersByTimeAsync(20);
      derivedWithPeek.get(); // Initial computation
      expect(derivedComputeCount).toBe(1);

      // Change source - asyncCell will recompute, but derivedWithPeek should NOT
      source.set(2);
      await vi.advanceTimersByTimeAsync(20);

      // derivedWithPeek should NOT have recomputed since it used peek()
      expect(derivedComputeCount).toBe(1);
    });

    test('peek() waits for upstream promises and pending state', async () => {
      const source = Cell.source(1);

      const a = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 25));
        return get(source) * 2;
      });

      const b = Cell.derivedAsync(async (get) => {
        const aVal = await get(a);
        await new Promise((r) => setTimeout(r, 25));
        return aVal + 100;
      });

      // Start the peek() call before computation completes
      const peekPromise = b.peek();

      // Advance time to allow computation to complete
      await vi.advanceTimersByTimeAsync(60);

      // peek() should have waited and returned the correct value
      expect(await peekPromise).toBe(102);
    });

    test('peek() works during recomputation', async () => {
      const source = Cell.source(1);

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 20));
        return get(source) * 10;
      });

      await vi.advanceTimersByTimeAsync(30);
      expect(await asyncCell.peek()).toBe(10);

      // Start a recomputation
      source.set(5);

      // peek() during recomputation should wait for the new value
      const peekPromise = asyncCell.peek();
      await vi.advanceTimersByTimeAsync(30);

      expect(await peekPromise).toBe(50);
    });

    test('Child cell promise should not release until computation is ready', async () => {
      const a = Cell.source(1);
      const b = Cell.derivedAsync(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return a.get() * 100;
      });
      const c = Cell.derivedAsync(async (get) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return (await get(b)) * 10;
      });
      const cPromise = c.get();
      a.set(2);
      await vi.advanceTimersByTimeAsync(100);
      expect(await cPromise).toBe(2000);
    });

    test('revalidate() should manually trigger recomputation', async () => {
      const source = Cell.source(5);
      let computeCount = 0;

      const asyncCell = Cell.derivedAsync(async (get) => {
        computeCount++;
        await new Promise((r) => setTimeout(r, 20));
        return get(source) * 2;
      });

      await vi.advanceTimersByTimeAsync(30);
      expect(await asyncCell.get()).toBe(10);
      expect(computeCount).toBe(1);

      // Manually revalidate without changing source
      asyncCell.revalidate();

      // Should be in pending state during recomputation
      expect(asyncCell.pending.get()).toBe(true);

      await vi.advanceTimersByTimeAsync(30);

      // Value should be the same but recomputed
      expect(await asyncCell.get()).toBe(10);
      expect(computeCount).toBe(2);
      expect(asyncCell.pending.get()).toBe(false);
    });

    test('revalidate() should abort in-flight computation', async () => {
      vi.useFakeTimers();
      const source = Cell.source(1);
      let abortedCount = 0;

      const asyncCell = Cell.derivedAsync(async (get, signal) => {
        signal.addEventListener('abort', () => abortedCount++);
        await new Promise((r) => setTimeout(r, 100));
        return get(source) * 10;
      });

      // Start initial computation
      const promise1 = asyncCell.get();

      // Advance partially
      await vi.advanceTimersByTimeAsync(50);

      // Revalidate should abort the first computation
      asyncCell.revalidate();

      await vi.advanceTimersByTimeAsync(150);

      // The first promise should resolve with the new value
      expect(await promise1).toBe(10);
      expect(abortedCount).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('Listeners', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('derived async cells should trigger listen callbacks', async () => {
      const a = Cell.source(10);
      const b = Cell.source(11);
      const c = Cell.derivedAsync(async (get) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return get(a) * get(b);
      });
      const d = Cell.derived(() => {
        return a.get() + b.get();
      });
      expect(d.get()).toBe(21);
      await vi.advanceTimersByTimeAsync(30);
      expect(await c.get()).toBe(110);

      const callback = vi.fn();
      c.listen(async (value) => {
        callback(await value);
      });

      b.set(10);
      await vi.advanceTimersByTimeAsync(10);

      expect(await c.get()).toBe(100);
      expect(d.get()).toBe(20);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(100);
    });

    test('listener fires on each value change', async () => {
      const source = Cell.source(1);
      const calls = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 2;
      });

      await vi.advanceTimersByTimeAsync(10);
      asyncCell.listen(async (p) => calls.push(await p));

      source.set(2);
      await vi.advanceTimersByTimeAsync(10);
      source.set(3);
      await vi.advanceTimersByTimeAsync(10);

      expect(calls).toEqual([4, 6]);
    });

    test('removed listener is not called', async () => {
      const source = Cell.source(1);
      const calls = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source);
      });

      await vi.advanceTimersByTimeAsync(10);
      const stop = asyncCell.listen(async (p) => calls.push(await p));

      source.set(2);
      await vi.advanceTimersByTimeAsync(10);
      stop();
      source.set(3);
      await vi.advanceTimersByTimeAsync(10);

      expect(calls).toEqual([2]);
    });

    test('multiple listeners all receive updates', async () => {
      const source = Cell.source(1);
      const c1 = [];
      const c2 = [];
      const c3 = [];

      const asyncCell = Cell.derivedAsync(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(source) * 10;
      });

      await vi.advanceTimersByTimeAsync(10);
      asyncCell.listen(async (p) => c1.push(await p));
      asyncCell.listen(async (p) => c2.push(await p));
      asyncCell.listen(async (p) => c3.push(await p));

      source.set(2);
      await vi.advanceTimersByTimeAsync(10);

      expect(c1).toEqual([20]);
      expect(c2).toEqual([20]);
      expect(c3).toEqual([20]);
    });
  });

  describe('Batching', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('batched updates trigger single recomputation', async () => {
      const s1 = Cell.source(1);
      const s2 = Cell.source(2);
      const computeFn = vi.fn(async (get) => {
        await new Promise((r) => setTimeout(r, 10));
        return get(s1) + get(s2);
      });

      const asyncCell = Cell.derivedAsync(computeFn);
      await vi.advanceTimersByTimeAsync(10);
      expect(computeFn).toHaveBeenCalledTimes(1);

      Cell.batch(() => {
        s1.set(10);
        s2.set(20);
      });

      await vi.advanceTimersByTimeAsync(50);

      expect(computeFn).toHaveBeenCalledTimes(2);
      expect(await asyncCell.get()).toBe(30);
    });
  });

  describe('Async Deadlock on Dispose', () => {
    test('Should release downstream cells immediately upon disposal', async () => {
      const context = Cell.context();
      let downstream;
      let asyncCell;
      Cell.runWithContext(context, () => {
        asyncCell = Cell.derivedAsync(async () => {
          return new Promise(() => {});
        });

        downstream = Cell.derivedAsync(async (get) => {
          return get(asyncCell); // Waits for upstream
        });

        // Initially, downstream should be pending because upstream is pending
        expect(downstream.pending.get()).toBe(true);
      });

      context.destroy();

      await new Promise((resolve) => setTimeout(resolve));
      expect(asyncCell.pending.get()).toBe(false);
      expect(downstream.pending.get()).toBe(false);

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadlock detected')), 100),
      );

      await expect(
        Promise.race([downstream.get(), timeout]),
      ).resolves.not.toThrow();
    });
  });
});

describe('Effect options', () => {
  test('Effects should be ignored if the signal is aborted', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    const abortController = new AbortController();
    const signal = abortController.signal;
    cell.listen(callback, { signal });
    abortController.abort();
    cell.set(2);
    expect(callback).not.toHaveBeenCalled();
  });

  test('Effects should be removed after the first run if once is true', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { once: true });
    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Effects should not be removed after the first run if once is false', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { once: false });
    cell.set(2);
    cell.set(3);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Effects should have a name', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { name: 'test' });
    expect(cell.isListeningTo('test')).toBe(true);
  });

  test('Effects should execute in order of priority', () => {
    const cell = Cell.source(1);

    let stream = '';
    const callback1 = () => {
      stream += 'World!';
    };

    const callback2 = () => {
      stream += 'Hello, ';
    };

    cell.listen(callback1, { priority: 1 });
    cell.listen(callback2, { priority: 2 });

    cell.set(2);

    expect(stream).toBe('Hello, World!');
  });

  test('Effects should throw an error if they are already listening to the cell with the same name', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { name: 'test' });
    expect(() => {
      cell.listen(callback, { name: 'test' });
    }).toThrowError(
      'An effect with the name "test" is already listening to this cell.',
    );
  });

  test('Effects should be able to be stopped', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { name: 'test' });
    cell.stopListeningTo('test');
    cell.set(2);
    expect(callback).not.toHaveBeenCalled();
  });

  test('Effects should be weakly referenced if specified', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { weak: true });
    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('Cell options', () => {
  test('Immutable cells should not allow updates', () => {
    const cell = Cell.source(1, { immutable: true });
    expect(() => {
      cell.set(2);
    }).toThrowError('Cannot set the value of an immutable cell.');
  });

  test('Cells should use custom equality functions', () => {
    const cell = Cell.source(
      { a: 1, b: 2 },
      {
        equals: (a, b) => a.a === b.a && a.b === b.b,
      },
    );
    const callback = vi.fn();
    cell.listen(callback);
    cell.set({ a: 1, b: 2 });
    expect(callback).toHaveBeenCalledTimes(0);

    cell.set({ a: 1, b: 3 });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

// NOTE: This describe block name is duplicated later. Consider renaming one.
describe('Derived Cells', () => {
  test('derived cells should have dynamic dependencies', () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const cb = vi.fn();

    const c = Cell.derived(() => {
      cb();
      if (a.get() > 1) {
        return a.get() + b.get();
      }
      return a.get();
    });

    expect(c.get()).toEqual(1);
    expect(cb).toHaveBeenCalledTimes(1);
    b.set(10);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(c.get()).toEqual(1); // No change.
    a.set(5);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(c.get()).toEqual(15);
    b.set(20);
    expect(cb).toHaveBeenCalledTimes(3);
    expect(c.get()).toEqual(25);
  });
});

describe('Equality Checks (deepEqual)', () => {
  test('should correctly compare primitive types', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback);

    cell.set(1);
    expect(callback).not.toHaveBeenCalled();
    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);
    cell.set(2);
    expect(callback).toHaveBeenCalledTimes(1);

    const strCell = Cell.source('hello');
    const strCallback = vi.fn();
    strCell.listen(strCallback);
    strCell.set('hello');
    expect(strCallback).not.toHaveBeenCalled();
    strCell.set('world');
    expect(strCallback).toHaveBeenCalledTimes(1);
  });

  test('should correctly compare dates', () => {
    const date1 = new Date(2023, 10, 21);
    const date2 = new Date(2023, 10, 21);
    const date3 = new Date(2023, 10, 22);

    const cell = Cell.source(date1);
    const callback = vi.fn();
    cell.listen(callback);

    cell.set(date2); // Same date value
    expect(callback).not.toHaveBeenCalled();

    cell.set(date3); // Different date value
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(date3);

    cell.set(date3); // Same date value again
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('should correctly compare simple objects', () => {
    const obj1 = { a: 1, b: 'test' };
    const obj2 = { a: 1, b: 'test' };
    const obj3 = { a: 1, b: 'different' };
    const obj4 = { a: 2, b: 'test' };

    const cell = Cell.source(obj1);
    const callback = vi.fn();
    cell.listen(callback);

    cell.set(obj2); // Structurally same
    expect(callback).not.toHaveBeenCalled();

    cell.set(obj3); // Different value for 'b'
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(obj3);

    cell.set(obj4); // Different value for 'a'
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(obj4);

    cell.set({ ...obj4 }); // Structurally same again
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('should correctly compare arrays', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3 = [1, 2, 4];
    const arr4 = [1, 2];

    const cell = Cell.source(arr1);
    const callback = vi.fn();
    cell.listen(callback);

    cell.set(arr2); // Same content
    expect(callback).not.toHaveBeenCalled();

    cell.set(arr3); // Different element
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(arr3);

    cell.set(arr4); // Different length
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(arr4);

    cell.set([...arr4]); // Same content again
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('should handle null and undefined comparisons', () => {
    const cell = /** @type {SourceCell<null | undefined | number>} */ (
      Cell.source(null)
    );
    const callback = vi.fn();
    cell.listen(callback);

    cell.set(null);
    expect(callback).not.toHaveBeenCalled();
    cell.set(undefined);
    expect(callback).toHaveBeenCalledTimes(1);
    cell.set(undefined);
    expect(callback).toHaveBeenCalledTimes(1);
    cell.set(0);
    expect(callback).toHaveBeenCalledTimes(2);
    cell.set(null);
    expect(callback).toHaveBeenCalledTimes(3);
  });
});

describe('Tracking contexts', () => {
  describe('Tracking contexts (Explicit Resource Management)', () => {
    test('Effect should stop immediately after context destruction', () => {
      const source = Cell.source(0);
      const context = Cell.context();
      const callback = vi.fn();

      Cell.runWithContext(context, () => {
        source.listen(callback);
      });

      source.set(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1);

      context.destroy();
      source.set(2);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('Derived cells should detach from sources after context destruction', () => {
      const source = Cell.source(10);
      const context = Cell.context();

      let derivedValue;

      Cell.runWithContext(context, () => {
        const derived = Cell.derived(() => source.get() * 2);

        derived.listen((val) => {
          derivedValue = val;
        });
      });

      source.set(20);
      expect(derivedValue).toBe(40);
      context.destroy();
      source.set(30);

      expect(derivedValue).toBe(40);
    });

    test('Nested contexts should handle stack correctly', () => {
      const globalSource = Cell.source(0);
      const parentContext = Cell.context();
      const childContext = Cell.context();

      const parentSpy = vi.fn();
      const childSpy = vi.fn();

      Cell.runWithContext(parentContext, () => {
        globalSource.listen(parentSpy);

        Cell.runWithContext(childContext, () => {
          globalSource.listen(childSpy);
        });
      });

      globalSource.set(1);
      expect(parentSpy).toHaveBeenCalledTimes(1);
      expect(childSpy).toHaveBeenCalledTimes(1);

      childContext.destroy();

      globalSource.set(2);
      expect(parentSpy).toHaveBeenCalledTimes(2);
      expect(childSpy).toHaveBeenCalledTimes(1);

      parentContext.destroy();

      globalSource.set(3);
      expect(parentSpy).toHaveBeenCalledTimes(2);
      expect(childSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Cell.createComposite', () => {
  test('combines sync cells into a composite', async () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const composite = Cell.createComposite({ a, b });

    expect(composite.pending.get()).toBe(false);
    expect(composite.error.get()).toBeNull();

    const aValue = await composite.values.a.get();
    const bValue = await composite.values.b.get();

    expect(aValue).toBe(1);
    expect(bValue).toBe(2);
  });

  test('combines async cells with pending tracking', async () => {
    const a = Cell.derivedAsync(async () => {
      await delay(10);
      return 'a-value';
    });
    const b = Cell.derivedAsync(async () => {
      await delay(20);
      return 'b-value';
    });

    const composite = Cell.createComposite({ a, b });

    expect(composite.pending.get()).toBe(true);
    expect(composite.error.get()).toBeNull();

    const [aValue, bValue] = await Promise.all([
      composite.values.a.get(),
      composite.values.b.get(),
    ]);

    expect(aValue).toBe('a-value');
    expect(bValue).toBe('b-value');
    expect(composite.pending.get()).toBe(false);
  });

  test('error propagates to all composite values', async () => {
    const error = new Error('test error');
    const a = Cell.derivedAsync(async () => {
      await delay(10);
      return 'a-value';
    });
    const b = Cell.derivedAsync(async () => {
      await delay(5);
      throw error;
    });

    const composite = Cell.createComposite({ a, b });

    await delay(30);

    // The composite error cell should reflect the first error from inputs
    expect(composite.error.get()).toEqual(error);

    // The composite value cells should also have errors set
    expect(composite.values.a.error.get()).toEqual(error);
    expect(composite.values.b.error.get()).toEqual(error);
  });

  test('values synchronize via barrier - all resolve together', async () => {
    const a = Cell.derivedAsync(async () => {
      await delay(50);
      return 'slow';
    });
    const b = Cell.derivedAsync(async () => {
      await delay(10);
      return 'fast';
    });

    const composite = Cell.createComposite({ a, b });

    const aPromise = composite.values.a.get();
    const bPromise = composite.values.b.get();

    const [aValue, bValue] = await Promise.all([aPromise, bPromise]);

    expect(aValue).toBe('slow');
    expect(bValue).toBe('fast');
  });

  test('mixed sync and async cells work together', async () => {
    const syncCell = Cell.source('sync-value');
    const asyncCell = Cell.derivedAsync(async () => {
      await delay(10);
      return 'async-value';
    });

    const composite = Cell.createComposite({
      sync: syncCell,
      async: asyncCell,
    });

    expect(composite.pending.get()).toBe(true);

    const [syncValue, asyncValue] = await Promise.all([
      composite.values.sync.get(),
      composite.values.async.get(),
    ]);

    expect(syncValue).toBe('sync-value');
    expect(asyncValue).toBe('async-value');
    expect(composite.pending.get()).toBe(false);
  });

  test('composite recovers after error and retry', async () => {
    let shouldFail = true;
    const source = Cell.source(1);

    const asyncCell = Cell.derivedAsync(async (get) => {
      const val = get(source);
      await delay(5);
      if (shouldFail) throw new Error('retry me');
      return val * 10;
    });

    const composite = Cell.createComposite({ value: asyncCell });

    await delay(20);
    expect(composite.error.get()?.message).toBe('retry me');

    shouldFail = false;
    source.set(2);

    await delay(20);
    expect(composite.error.get()).toBeNull();

    const value = await composite.values.value.get();
    expect(value).toBe(20);
  });

  test('pending state updates correctly', async () => {
    const source = Cell.source(1);
    const pendingValues = [];

    const asyncCell = Cell.derivedAsync(async (get) => {
      const val = get(source);
      await delay(10);
      return val;
    });

    const composite = Cell.createComposite({ value: asyncCell });

    // Initial state
    expect(composite.pending.get()).toBe(true);

    composite.pending.listen((val) => pendingValues.push(val));

    await delay(20);
    expect(composite.pending.get()).toBe(false);
    expect(pendingValues).toContain(false);

    source.set(2);
    expect(composite.pending.get()).toBe(true);
    expect(pendingValues).toContain(true);

    await delay(20);
    expect(composite.pending.get()).toBe(false);
  });

  test('barrier ensures no partial reads during updates', async () => {
    const source = Cell.source(1);

    const a = Cell.derivedAsync(async (get) => {
      const val = get(source);
      await delay(10);
      return `a-${val}`;
    });
    const b = Cell.derivedAsync(async (get) => {
      const val = get(source);
      await delay(20);
      return `b-${val}`;
    });

    const composite = Cell.createComposite({ a, b });

    await delay(30);

    const valueA1 = await composite.values.a.get();
    const valueB1 = await composite.values.b.get();
    expect(valueA1).toBe('a-1');
    expect(valueB1).toBe('b-1');

    source.set(2);

    const valueA2 = await composite.values.a.get();
    const valueB2 = await composite.values.b.get();
    expect(valueA2).toBe('a-2');
    expect(valueB2).toBe('b-2');
  });

  test('only tracks pending and error from AsyncDerivedCells', () => {
    const syncCell = Cell.source('value');
    const asyncCell = Cell.derivedAsync(async () => 'async');

    const composite = Cell.createComposite({
      sync: syncCell,
      async: asyncCell,
    });

    expect(composite.pending.get()).toBe(true);
    expect(composite.error.get()).toBeNull();
  });

  test('composite with single cell works correctly', async () => {
    const asyncCell = Cell.derivedAsync(async () => {
      await delay(10);
      return 'single';
    });

    const composite = Cell.createComposite({ value: asyncCell });

    expect(composite.pending.get()).toBe(true);

    const value = await composite.values.value.get();
    expect(value).toBe('single');
    expect(composite.pending.get()).toBe(false);
    expect(composite.error.get()).toBeNull();
  });

  test('empty composite is valid', () => {
    const composite = Cell.createComposite({});

    expect(composite.pending.get()).toBe(false);
    expect(composite.error.get()).toBeNull();
    expect(Object.keys(composite.values)).toHaveLength(0);
  });
});

describe('Cell.task()', () => {
  test('should create an AsyncTaskCell', () => {
    const task = Cell.task(async (input) => input * 2);
    expect(task).toBeDefined();
    expect(task.runWith).toBeDefined();
    expect(typeof task.runWith).toBe('function');
  });

  test('should execute task with input and return result', async () => {
    const task = Cell.task(async (input) => input * 2);
    const result = await task.runWith(5);
    expect(result).toBe(10);
  });

  test('should handle string input', async () => {
    const task = Cell.task(async (input) => input.toUpperCase());
    const result = await task.runWith('hello');
    expect(result).toBe('HELLO');
  });

  test('should handle object input', async () => {
    const task = Cell.task(async (input) => ({ ...input, processed: true }));
    const result = await task.runWith({ id: 1, name: 'test' });
    expect(result).toEqual({ id: 1, name: 'test', processed: true });
  });

  test('should handle array input', async () => {
    const task = Cell.task(async (input) => input.map((x) => x * 2));
    const result = await task.runWith([1, 2, 3]);
    expect(result).toEqual([2, 4, 6]);
  });

  test('should set pending state during execution', async () => {
    const task = Cell.task(async (input) => {
      await delay(10);
      return input * 2;
    });

    // Initial state - pending should be false until runWith is called
    expect(task.pending.get()).toBe(false);

    const promise = task.runWith(5);
    expect(task.pending.get()).toBe(true);

    await promise;
    expect(task.pending.get()).toBe(false);
  });

  test('should handle errors and set error state', async () => {
    const task = Cell.task(async (input) => {
      if (input < 0) {
        throw new Error('Input must be positive');
      }
      return input * 2;
    });

    expect(task.error.get()).toBeNull();

    const result = await task.runWith(5);
    expect(result).toBe(10);
    expect(task.error.get()).toBeNull();

    await task.runWith(-1);
    expect(task.error.get()).toBeInstanceOf(Error);
    expect(task.error.get()?.message).toBe('Input must be positive');
  });

  test('should clear error on successful execution after error', async () => {
    const shouldError = Cell.source(false);

    const task = Cell.task(async (input) => {
      if (shouldError.get()) {
        throw new Error('Task failed');
      }
      return input * 2;
    });

    // First successful execution
    let result = await task.runWith(5);
    expect(result).toBe(10);
    expect(task.error.get()).toBeNull();

    // Error execution
    shouldError.set(true);
    await task.runWith(5);
    expect(task.error.get()).toBeInstanceOf(Error);

    // Recovery execution
    shouldError.set(false);
    result = await task.runWith(3);
    expect(result).toBe(6);
    expect(task.error.get()).toBeNull();
  });

  test('should return different promises for concurrent calls', async () => {
    let callCount = 0;
    const task = Cell.task(async (input) => {
      callCount++;
      await delay(10);
      return input * 2;
    });

    // First, complete any initial computation
    await task.runWith(1);
    callCount = 0; // Reset counter

    // Now test concurrent calls - each should create a new promise
    // The second call aborts the first, so the first promise resolves
    // to the previous stable value (2) via the tripwire mechanism
    const promise1 = task.runWith(5);
    const promise2 = task.runWith(5);

    // First promise resolves to previous stable value (from runWith(1))
    // Second promise resolves to new value
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toBe(2); // Aborted, resolves to last stable
    expect(result2).toBe(10); // Completes successfully
    // Function should be called for each concurrent request
    expect(callCount).toBe(2);
  });

  test('should create new promise for subsequent calls after completion', async () => {
    let callCount = 0;
    const task = Cell.task(async (input) => {
      callCount++;
      return input * 2;
    });

    const promise1 = task.runWith(5);
    await promise1;

    const promise2 = task.runWith(5);
    expect(promise1).not.toBe(promise2);

    const result = await promise2;
    expect(result).toBe(10);
    expect(callCount).toBe(2);
  });

  test('should pass AbortSignal to task function', async () => {
    const task = Cell.task(async (input, signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      await delay(10);
      if (signal.aborted) {
        throw new Error('Aborted');
      }
      return input * 2;
    });

    const result = await task.runWith(5);
    expect(result).toBe(10);
  });

  test('should handle task returning different types', async () => {
    const task = Cell.task(async (input) => {
      if (input === 'number') return 42;
      if (input === 'string') return 'hello';
      if (input === 'object') return { key: 'value' };
      if (input === 'array') return [1, 2, 3];
      if (input === 'null') return null;
      if (input === 'undefined') return undefined;
      return 'default';
    });

    expect(await task.runWith('number')).toBe(42);
    expect(await task.runWith('string')).toBe('hello');
    expect(await task.runWith('object')).toEqual({ key: 'value' });
    expect(await task.runWith('array')).toEqual([1, 2, 3]);
    expect(await task.runWith('null')).toBeNull();
    expect(await task.runWith('undefined')).toBeUndefined();
  });

  test('should be listenable for value changes', async () => {
    const task = Cell.task(async (input) => input * 2);
    const values = [];

    task.listen(async (promise) => {
      const value = await promise;
      values.push(value);
    });

    await task.runWith(5);
    await task.runWith(10);
    await task.runWith(15);

    // Wait for all async listeners to complete
    await delay(0);

    expect(values).toEqual([10, 20, 30]);
  });

  test('should be listenable for error state', async () => {
    const shouldError = Cell.source(false);
    const errors = [];

    const task = Cell.task(async (input, signal) => {
      if (shouldError.get()) {
        throw new Error(`Error ${input}`);
      }
      return input * 2;
    });

    task.error.listen((err) => {
      if (err) errors.push(err.message);
    });

    await task.runWith(1);
    expect(errors).toEqual([]);

    shouldError.set(true);
    await task.runWith(2);
    expect(errors).toContain('Error 2');

    shouldError.set(false);
    await task.runWith(3);
    expect(errors).toContain('Error 2');
  });

  test('should handle async operations with delay', async () => {
    const task = Cell.task(async (input) => {
      await delay(50);
      return `${input} processed`;
    });

    const startTime = Date.now();
    const result = await task.runWith('data');
    const endTime = Date.now();

    expect(result).toBe('data processed');
    expect(endTime - startTime).toBeGreaterThanOrEqual(45);
  });

  test('should handle synchronous-looking task', async () => {
    const task = Cell.task((input) => {
      return Promise.resolve(input * 3);
    });

    const result = await task.runWith(7);
    expect(result).toBe(21);
  });

  test('should not auto-execute task function on creation', async () => {
    let executed = false;
    const task = Cell.task(async (input) => {
      executed = true;
      return input;
    });

    // Task function should not have been called yet
    expect(executed).toBe(false);
    // Pending should be false initially
    expect(task.pending.get()).toBe(false);

    await task.runWith(1);
    expect(executed).toBe(true);
    expect(task.pending.get()).toBe(false);
  });

  test('should handle multiple different inputs', async () => {
    const task = Cell.task(async (input) => input * 2);

    const result1 = await task.runWith(5);
    const result2 = await task.runWith(10);
    const result3 = await task.runWith('hello');

    expect(result1).toBe(10);
    expect(result2).toBe(20);
    expect(result3).toBeNaN(); // "hello" * 2 = NaN
  });

  test('should work with Cell.derived to create dependent computations', async () => {
    const task = Cell.task(async (input) => input * 2);

    const derived = Cell.derived(() => {
      return task.pending.get() ? 'loading' : 'ready';
    });

    // Initially ready since pending is false
    expect(derived.get()).toBe('ready');

    const promise = task.runWith(5);
    expect(derived.get()).toBe('loading');

    await promise;
    expect(derived.get()).toBe('ready');
  });

  test('should work with Cell.createComposite for single task', async () => {
    const task = Cell.task(async (input) => {
      await delay(10);
      return input * 2;
    });

    const composite = Cell.createComposite({ result: task });

    // Before running, composite should not be pending
    expect(composite.pending.get()).toBe(false);

    // Execute the task
    const runPromise = task.runWith(5);
    expect(composite.pending.get()).toBe(true);

    await runPromise;
    expect(composite.pending.get()).toBe(false);

    const value = await composite.values.result.get();
    expect(value).toBe(10);
  });

  test('should work with Cell.createComposite for multiple tasks', async () => {
    const taskA = Cell.task(async (input) => {
      await delay(10);
      return input * 2;
    });
    const taskB = Cell.task(async (input) => {
      await delay(20);
      return input + 100;
    });

    const composite = Cell.createComposite({ taskA, taskB });

    expect(composite.pending.get()).toBe(false);

    // Start both tasks
    const promiseA = taskA.runWith(5);
    const promiseB = taskB.runWith(50);

    // Composite should be pending while any task is running
    expect(composite.pending.get()).toBe(true);

    await Promise.all([promiseA, promiseB]);
    expect(composite.pending.get()).toBe(false);

    const valueA = await composite.values.taskA.get();
    const valueB = await composite.values.taskB.get();

    expect(valueA).toBe(10);
    expect(valueB).toBe(150);
  });

  test('should propagate task errors to composite', async () => {
    const task = Cell.task(async (input) => {
      if (input < 0) {
        throw new Error('Negative input not allowed');
      }
      return input * 2;
    });

    const composite = Cell.createComposite({ task });

    expect(composite.error.get()).toBeNull();

    // Trigger an error
    await task.runWith(-1);
    await delay(0);

    expect(composite.error.get()).toBeInstanceOf(Error);
    expect(composite.error.get()?.message).toBe('Negative input not allowed');
  });

  test('should allow tasks in composite to be independently executed', async () => {
    const taskA = Cell.task(async (input) => input * 2);
    const taskB = Cell.task(async (input) => input + 10);

    const composite = Cell.createComposite({ taskA, taskB });

    // Execute only taskA
    await taskA.runWith(5);
    let valueA = await composite.values.taskA.get();
    expect(valueA).toBe(10);

    // Execute taskB later
    await taskB.runWith(20);
    let valueB = await composite.values.taskB.get();
    expect(valueB).toBe(30);

    // Execute both again with different values
    await taskA.runWith(100);
    await taskB.runWith(5);

    valueA = await composite.values.taskA.get();
    valueB = await composite.values.taskB.get();

    expect(valueA).toBe(200);
    expect(valueB).toBe(15);
  });

  test('should handle mixed sync and task cells in composite', async () => {
    const syncCell = Cell.source(42);
    const task = Cell.task(async (input) => {
      await delay(10);
      return input * 3;
    });

    const composite = Cell.createComposite({ sync: syncCell, async: task });

    // Sync cell should be immediately available
    const syncValue = await composite.values.sync.get();
    expect(syncValue).toBe(42);

    // Execute task
    const runPromise = task.runWith(5);
    expect(composite.pending.get()).toBe(true);

    await runPromise;
    const asyncValue = await composite.values.async.get();
    expect(asyncValue).toBe(15);
    expect(composite.pending.get()).toBe(false);
  });

  test('should work with Cell.derivedAsync for dependent async computations', async () => {
    const task = Cell.task(async (userId) => {
      await delay(10);
      return { id: userId, name: `User ${userId}` };
    });

    // Create a derivedAsync that depends on the task
    const userDetails = Cell.derivedAsync(async (get) => {
      const user = await get(task);
      await delay(5);
      return { ...user, details: `Details for ${user.name}` };
    });

    // Execute the task
    await task.runWith(123);

    // The derivedAsync should have computed based on task result
    const details = await userDetails.get();
    expect(details).toEqual({
      id: 123,
      name: 'User 123',
      details: 'Details for User 123',
    });
  });

  test('derivedAsync should recompute when task is re-executed', async () => {
    const task = Cell.task(async (value) => {
      await delay(5);
      return value * 2;
    });

    const doubled = Cell.derivedAsync(async (get) => {
      const result = await get(task);
      await delay(5);
      return result * 2;
    });

    // First execution
    await task.runWith(5);
    let result = await doubled.get();
    expect(result).toBe(20); // (5 * 2) * 2

    // Second execution - derivedAsync should recompute
    await task.runWith(10);
    result = await doubled.get();
    expect(result).toBe(40); // (10 * 2) * 2
  });

  test('derivedAsync pending state should reflect task execution', async () => {
    const task = Cell.task(async (input) => {
      await delay(20);
      return input;
    });

    const derived = Cell.derivedAsync(async (get) => {
      const value = await get(task);
      return value * 2;
    });

    // Initially not pending
    expect(derived.pending.get()).toBe(true);

    // Start task execution
    const taskPromise = task.runWith(5);

    // Both should be pending
    expect(task.pending.get()).toBe(true);
    expect(derived.pending.get()).toBe(true);

    await taskPromise;

    // Wait for derived to complete
    await derived.get();

    expect(task.pending.get()).toBe(false);
    expect(derived.pending.get()).toBe(false);
  });

  test('should handle errors from task in derivedAsync', async () => {
    const task = Cell.task(async (shouldFail) => {
      await delay(5);
      if (shouldFail) {
        throw new Error('Task failed');
      }
      return 'success';
    });

    const derived = Cell.derivedAsync(async (get) => {
      const result = await get(task);
      return `Derived: ${result}`;
    });

    // Successful execution
    await task.runWith(false);
    await delay(0);
    let result = await derived.get();
    expect(result).toBe('Derived: success');
    expect(task.error.get()).toBeNull();

    // Failed execution - task keeps last successful value (SWR pattern)
    await task.runWith(true);
    await delay(0);
    result = await derived.get();
    expect(result).toBe('Derived: success'); // Keeps last successful value
    expect(task.error.get()).toBeInstanceOf(Error);
    expect(task.error.get()?.message).toBe('Task failed');
  });

  test('derivedAsync can read multiple tasks', async () => {
    const taskA = Cell.task(async (value) => {
      await delay(10);
      return value * 2;
    });

    const taskB = Cell.task(async (value) => {
      await delay(15);
      return value + 10;
    });

    const combined = Cell.derivedAsync(async (get) => {
      const [a, b] = await Promise.all([get(taskA), get(taskB)]);
      return a + b;
    });

    // Execute both tasks
    await taskA.runWith(5);
    await taskB.runWith(3);

    const result = await combined.get();
    expect(result).toBe(23); // (5 * 2) + (3 + 10)
  });
});
