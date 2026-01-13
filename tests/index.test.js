import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Cell, SourceCell } from '../library/index.js';

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
    const cell = Cell.source(
      {
        a: 1,
        b: { c: 2, d: 3 },
      },
      { deep: true },
    );
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

    cell.get().b.c = 2;
    expect(callback).toHaveBeenCalledTimes(1);

    cell.get().b.c = 67;
    expect(callback).toHaveBeenCalledTimes(2);
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

describe('Nested cells', () => {
  test('Cell of object type should be reactive', () => {
    const cell = Cell.source({ a: 1 });
    const cell2 = Cell.source({ b: 10 });

    const derived = Cell.derived(() => cell.get().a + cell2.get().b);

    cell.get().a = 2; // Deep reactivity test
    expect(derived.get()).toBe(12);

    cell2.get().b = 20; // Deep reactivity test
    expect(derived.get()).toBe(22);
  });

  test('Derived cell of object type should run callback when value changes', () => {
    const cell = Cell.source({ a: 'hello', b: 1, c: true, d: null });
    const callback = vi.fn();

    const derived = Cell.derived(() => {
      callback();
      return cell.get().a;
    });
    expect(derived.get()).toBe('hello');
    expect(callback).toHaveBeenCalledTimes(1);

    cell.set({ a: 'world', b: 2, c: false, d: null });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Cell of map type should be able to read entries', () => {
    const cell = Cell.source(new Map());
    cell.get().set('a', 1);
    cell.get().set('b', 2);

    const array = Cell.derived(() => Array.from(cell.get().entries()));

    cell.get().set('c', 3);

    expect(array.get()).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  test('Cell of array type should be reactive', () => {
    const cell = Cell.source([1, 2, 3]);

    const sum = Cell.derived(() => cell.get().reduce((a, b) => a + b, 0));
    expect(sum.get()).toBe(6);

    cell.get()[0] = 3; // Deep reactivity test
    expect(sum.get()).toBe(8);

    cell.get().push(4); // Deep reactivity test
    expect(sum.get()).toBe(12);

    cell.get().pop(); // Deep reactivity test
    expect(sum.get()).toBe(8);
  });

  test('Cell of nested array type should be reactive', () => {
    /** @type {SourceCell<[number, [number, number], number]>} */
    const cell = Cell.source([1, [2, 3], 4], { deep: true });
    const d1 = Cell.derived(() => cell.get()[1][1] + 2);
    const d2 = Cell.derived(() => cell.get()[1][0] + d1.get());

    expect(d1.get()).toBe(5);
    expect(d2.get()).toBe(7);
    cell.get()[1][1] = 5; // Deep reactivity test

    expect(d1.get()).toBe(7);
    expect(d2.get()).toBe(9);
  });

  test('Cells of maps should be reactive', () => {
    const cell = Cell.source(new Map());
    const derived = Cell.derived(() => cell.get().get('a'));

    expect(derived.get()).toBe(undefined);

    cell.get().set('a', 1); // Deep reactivity test
    expect(derived.get()).toBe(1);

    cell.get().set('a', 2); // Deep reactivity test
    expect(derived.get()).toBe(2);
  });

  test('Cells of sets should be reactive', () => {
    const cell = Cell.source(new Set());
    const derived = Cell.derived(() => cell.get().has(1));
    const size = Cell.derived(() => cell.get().size);

    expect(derived.get()).toBe(false);
    expect(size.get()).toBe(0);

    cell.get().add(1); // Deep reactivity test
    expect(derived.get()).toBe(true);
    expect(size.get()).toBe(1);

    cell.get().add(2); // Deep reactivity test
    expect(derived.get()).toBe(true);
    expect(size.get()).toBe(2);
  });

  test('Cells of dates should be reactive', () => {
    const cell = Cell.source(new Date());
    const callback = vi.fn();
    cell.listen(callback);

    cell.set(new Date(2022, 1, 1));
    expect(callback).toHaveBeenCalledTimes(1);
    cell.set(new Date(2022, 1, 1));
    expect(callback).toHaveBeenCalledTimes(1);

    cell.get().setMonth(2);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Cell should handle built-in operators on objects', () => {
    const cell = Cell.source({ a: 1, b: 2 });
    const derived = Cell.derived(() => cell.get().a + cell.get().b);

    cell.get().a += 2;
    expect(derived.get()).toBe(5);

    cell.get().b += 2;
    expect(derived.get()).toBe(7);

    cell.get().a++;
    expect(derived.get()).toBe(8);

    cell.get().b--;
    expect(derived.get()).toBe(7);
  });

  test('Cell should handle built-in operators on arrays', () => {
    const cell = Cell.source([1, 2, 3]);
    const derived = Cell.derived(() => {
      return cell.get().map((x) => x + 5);
    });

    expect(derived.get()).toEqual([6, 7, 8]);

    cell.get()[0]++;

    expect(derived.get()).toEqual([7, 7, 8]);
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

describe('Flattening', () => {
  test('Flattening should work', () => {
    const cell = Cell.source(1);
    const value = Cell.flatten(cell);
    expect(value).toBe(1);
  });

  test('Flattening should work with nested cells', () => {
    const cell = Cell.source(Cell.source(1));
    const value = Cell.flatten(cell);
    expect(value).toBe(1);
  });

  test('Flattening should work with nested derived cells', () => {
    const cell = Cell.source(Cell.source(1));
    const value = Cell.flatten(Cell.derived(() => cell.get()));
    expect(value).toBe(1);
  });

  test('Flattening should work on arrays', () => {
    const cell = [1, 2, Cell.source(3)];
    const value = Cell.flattenArray(cell);
    expect(value).toEqual([1, 2, 3]);
  });

  test('Flattening should work on objects', () => {
    const cell = { a: 1, b: Cell.source(2) };
    const value = Cell.flattenObject(cell);
    expect(value).toEqual({ a: 1, b: 2 });
  });
});

describe('Cell.async', () => {
  test('Should work with a simple function', async () => {
    const { data, run } = Cell.async(async () => await 1);
    await run();
    expect(data.get()).toBe(1);
  });

  test('Should catch errors in getter function', async () => {
    const getter = async () => {
      await true;
      throw new Error('Something went wrong!');
    };

    const { data, error, run } = Cell.async(getter);
    await run();
    expect(data.get()).toBe(null);
    expect(error.get()).toHaveProperty('message', 'Something went wrong!');
  });

  test('Should update loading state', async () => {
    const getter = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      return true;
    };

    const { data, run, pending } = Cell.async(getter);
    const runPromise = run();

    expect(data.get()).toBe(null);
    expect(pending.get()).toBe(true);

    await runPromise;

    expect(data.get()).toBe(true);
    expect(pending.get()).toBe(false);
  });

  test('Should abort previous async operations when a new one starts', async () => {
    const getter = vi.fn(async function (value) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve(value * 2));
        this.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      });
      return value * 2;
    });

    const { data, run, error } = Cell.async(getter);

    const promise1 = run(5);
    await new Promise((resolve) => setTimeout(resolve));
    const promise2 = run(10);

    await Promise.allSettled([promise1, promise2]);

    expect(data.get()).toBe(20); // 10 * 2
    expect(getter).toHaveBeenCalledTimes(2);
  });

  test('Should pass AbortSignal to getter function', async () => {
    const getter = vi.fn(async function (value) {
      expect(this.signal).toBeInstanceOf(AbortSignal);
      return value;
    });

    const { data, run } = Cell.async(getter);
    const result = await run(42);
    expect(result).toBe(42);
    expect(data.get()).toBe(42);
    expect(getter).toHaveBeenCalledWith(42);
  });

  test('run() should return the response data', async () => {
    const { data, run } = Cell.async(async (value) => value * 2);
    const result = await run(5);
    expect(result).toBe(10);
    expect(data.get()).toBe(10);
  });

  test('run() should return null on error', async () => {
    const getter = async () => {
      throw new Error('Test error');
    };
    const { data, run } = Cell.async(getter);
    const result = await run();
    expect(result).toBe(null);
    expect(data.get()).toBe(null);
  });

  test('run() should abort and return null if previous operation is aborted', async () => {
    let callCount = 0;
    const getter = vi.fn(async function () {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve));
      if (this.signal.aborted) {
        throw new Error('Aborted');
      }
      return `result${callCount}`;
    });

    const { data, run } = Cell.async(getter);

    // Start first run
    const promise1 = run();

    // Quickly start second run
    await new Promise((resolve) => setTimeout(resolve));
    const result2 = await run();

    // Wait for first to settle
    await promise1.catch(() => {});

    expect(callCount).toBe(2);
    expect(result2).toBe('result2');
    expect(data.get()).toBe('result2');
  });

  test('AbortSignal should be properly aborted on new run()', async () => {
    const abortedSignals = [];
    const getter = vi.fn(async function (value) {
      this.signal.addEventListener('abort', () => abortedSignals.push(value));
      await new Promise((resolve) => setTimeout(resolve));
      return value;
    });

    const { run } = Cell.async(getter);

    // Start first run
    run(1);

    // Start second run before first completes
    await new Promise((resolve) => setTimeout(resolve));
    await run(2);

    expect(abortedSignals).toContain(1);
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

  test('derived async cells should trigger listen callbacks', async () => {
    const a = Cell.source(10);
    const b = Cell.source(11);
    const c = Cell.derivedAsync(async (get) => {
      await new Promise((resolve) => setTimeout(resolve));
      return get(a) * get(b);
    });
    const d = Cell.derived(() => {
      return a.get() + b.get();
    });
    expect(d.get()).toBe(21);
    expect(await c.get()).toBe(110);

    const callback = vi.fn();
    c.listen(async (value) => {
      callback(await value);
    });

    b.set(10);
    expect(await c.get()).toBe(100);
    expect(d.get()).toBe(20);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(100);
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

      source.set(1);
      source.set(2);
      await vi.advanceTimersByTimeAsync(200);

      expect(await asyncA.get()).toBe(20);
      expect(await asyncB.get()).toBe(21);
    });
  });

  describe('Listeners', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

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
  test('Cells should be deeply proxied if specified', () => {
    const cell = Cell.source({ a: 1, b: { c: 5 } }, { deep: true });
    const callback = vi.fn();
    cell.listen(callback);
    cell.get().b.c = 2; // Deep reactivity test
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Cells should be shallowly proxied by default', () => {
    const cell = Cell.source({ a: 1, b: { c: 5 } });
    const callback = vi.fn();
    cell.listen(callback);
    cell.get().a = 2; // Deep reactivity test
    expect(callback).toHaveBeenCalledTimes(1);

    cell.get().b.c = 90; // Should not trigger update
    expect(callback).toHaveBeenCalledTimes(1);
  });

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
