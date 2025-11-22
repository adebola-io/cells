import { describe, expect, test, vi } from 'vitest';
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
    console.log('derived1:', derived1);
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

  test('Glitch Test: Mathematical Constraint Violation', () => {
    const number = Cell.source(10);
    const toggle = Cell.source(false);

    const double = Cell.derived(() => {
      if (toggle.get()) return number.get() * 2;
      return 0;
    });

    const sum = Cell.derived(() => {
      console.log('Evaluating summ');
      return number.get() + double.get();
    });

    expect(sum.get()).toBe(10);
    toggle.set(true);
    expect(sum.get()).toBe(30);

    number.set(20);

    console.log('FINALA', double.depth, sum.depth);
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
});

describe('Nested cells', () => {
  test('Cell of object type should be reactive', () => {
    const cell = Cell.source({ a: 1 });
    const cell2 = Cell.source({ b: 10 });

    const derived = Cell.derived(() => cell.get().a + cell2.get().b);

    cell.get().a = 2; // Deep reactivity test
    expect(derived.get()).toBe(12);

    cell2.get().b = 20; // Deep reactivity test
    console.log('Changed to ', cell2.get(), cell.get(), derived.get());
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

    console.log(cell.get());
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
      await new Promise((resolve) => setTimeout(resolve, 500));
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
        const timeout = setTimeout(() => resolve(value * 2), 100);
        this.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        });
      });
      return value * 2;
    });

    const { data, run, error } = Cell.async(getter);

    const promise1 = run(5);
    await new Promise((resolve) => setTimeout(resolve, 10));
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
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (this.signal.aborted) {
        throw new Error('Aborted');
      }
      return `result${callCount}`;
    });

    const { data, run } = Cell.async(getter);

    // Start first run
    const promise1 = run();

    // Quickly start second run
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result2 = await run();

    // Wait for first to settle
    await promise1.catch(() => {});

    expect(callCount).toBe(2);
    expect(result2).toBe('result2');
    expect(data.get()).toBe('result2');
  });

  test('run() should handle rapid successive calls correctly', async () => {
    const completed = [];
    const getter = vi.fn(async function (id) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (this.signal.aborted) return null;
      completed.push(id);
      return id;
    });

    const { data, run } = Cell.async(getter);

    // Start multiple runs rapidly - only the last should succeed
    const results = await Promise.all([
      run('first'),
      run('second'),
      run('third'),
    ]);

    expect(results).toEqual([null, null, 'third']); // First two aborted
    expect(data.get()).toBe('third'); // Last one wins
    expect(completed).toEqual(['third']); // Only last completes
  });

  test('AbortSignal should be properly aborted on new run()', async () => {
    const abortedSignals = [];
    const getter = vi.fn(async function (value) {
      this.signal.addEventListener('abort', () => abortedSignals.push(value));
      await new Promise((resolve) => setTimeout(resolve, 50));
      return value;
    });

    const { run } = Cell.async(getter);

    // Start first run
    run(1);

    // Start second run before first completes
    await new Promise((resolve) => setTimeout(resolve, 10));
    await run(2);

    expect(abortedSignals).toContain(1);
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
