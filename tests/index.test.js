import { describe, expect, test, vi } from 'vitest';
import { Cell, SourceCell } from '../library/index.js';

describe('Cells', () => {
  test('Creates a reactive Cell of type T', () => {
    const cell = Cell.source(1);
    expect(cell.value).toBe(1);
  });

  test('Cell should be reactive', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback);
    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });

  test('Cell should ignore updates for deeply equal values', () => {
    const cell = Cell.source(
      {
        a: 1,
        b: { c: 2, d: 3 },
      },
      { deep: true }
    );
    const callback = vi.fn();
    cell.listen(callback);

    cell.value = {
      a: 1,
      b: { c: 2, d: 3 },
    };
    expect(callback).toHaveBeenCalledTimes(0);

    cell.value = {
      a: 1,
      b: { c: 2, d: 4 },
    };
    expect(callback).toHaveBeenCalledTimes(1);

    cell.value.b.c = 2;
    expect(callback).toHaveBeenCalledTimes(1);

    cell.value.b.c = 67;
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Cell should handle built-in operators', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    const unsubscribe = cell.listen(callback);
    cell.value += 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3);
    unsubscribe();
  });
});

describe('Effects', () => {
  test('Cell should handle nested subscriptions', () => {
    const cell = Cell.source(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const unsubscribe1 = cell.listen(callback1);
    const unsubscribe2 = cell.listen(callback2);
    cell.value = 2;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith(2);
    unsubscribe1();
    cell.value = 3;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledWith(3);
    unsubscribe2();
  });

  test('Cell should handle unsubscribe', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    const unsubscribe = cell.listen(callback);
    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    cell.value = 3;
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
    cell.value = 2;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    unsubscribe2();
    cell.value = 3;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
    unsubscribe1();
    unsubscribe3();
    cell.value = 4;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
  });
});

describe('Derived cells', () => {
  test('Creates a reactive Derived cell of type T', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => cell1.value + cell2.value);
    expect(derived.value).toBe(3);
  });

  test('Derived cell objects should be reactive', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => ({
      a: cell1.value + cell2.value,
    }));
    const a = Cell.derived(() => derived.value.a);
    expect(derived.value).toEqual({ a: 3 });

    cell1.value = 3;
    expect(a.value).toEqual(5);
  });

  test('Derived cell should be reactive', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => cell1.value + cell2.value);
    const callback = vi.fn();
    derived.listen(callback);
    cell1.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(5);

    const name = Cell.source('John');
    const surname = Cell.source('Smith');
    const fullname = Cell.derived(() => `${name.value} ${surname.value}`);
    expect(fullname.value).toBe('John Smith');

    name.value = 'Jane';
    expect(fullname.value).toBe('Jane Smith');
  });

  test('Derived cell should handle multiple dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const cell3 = Cell.source(3);
    const derived = Cell.derived(() => cell1.value + cell2.value + cell3.value);
    const callback = vi.fn();
    derived.listen(callback);
    cell1.value = 4;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(9);
    cell2.value = 5;
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(12);
    cell3.value = 6;
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith(15);
  });

  test('Derived cells should not depend on same cell multiple times', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback);

    const derived1 = Cell.derived(() => cell.value + cell.value);
    expect(derived1.value).toBe(2);

    cell.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Derived cell should handle nested dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived1 = Cell.derived(() => cell1.value + cell2.value);
    const derived2 = Cell.derived(() => derived1.value * 2);
    const callback = vi.fn();
    derived2.listen(callback);
    cell1.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
    cell2.value = 4;
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(14);
  });

  test('Derived cell should handle circular dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2); // 4
    const derived1 = Cell.derived(() => cell2.value + 1);
    const derived2 = Cell.derived(() => derived1.value + cell1.value);

    cell2.value = derived2.value;
    expect(cell2.value).toBe(4);
    expect(derived2.value).toBe(6);

    const callback = vi.fn();
    derived2.listen(callback);

    cell1.value = 3;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(8);
  });

  test('Derived cell should handle multiple subscriptions and unsubscriptions', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => cell1.value + cell2.value);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const unsubscribe1 = derived.listen(callback1);
    const unsubscribe2 = derived.listen(callback2);
    const unsubscribe3 = derived.listen(callback3);
    cell1.value = 3;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    unsubscribe2();
    cell2.value = 4;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
    unsubscribe1();
    unsubscribe3();
    cell1.value = 5;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
  });

  test('Cell.derived should not update if the value is the same', () => {
    const cell = Cell.source('hello');
    const callback = vi.fn();

    const derived = Cell.derived(() => {
      return cell.value.length;
    });
    expect(derived.value).toBe(5);

    derived.listen(callback);

    cell.value = 'world';

    expect(derived.value).toBe(5);

    expect(callback).toHaveBeenCalledTimes(0);
  });

  test('Derived cell should update in the order of dependencies', () => {
    const source = Cell.source('Hello');

    let string = '';
    const derived1 = Cell.derived(() => {
      string += '1';
      return source.value.length;
    });
    const derived2 = Cell.derived(() => {
      string += '2';
      return `${source.value} World`;
    });
    expect(derived1.value).toBe(5);
    expect(derived2.value).toBe('Hello World');
    expect(string).toBe('12');

    source.value = 'Goodbye';
    expect(derived1.value).toBe(7);
    expect(derived2.value).toBe('Goodbye World');
    expect(string).toBe('1212');

    const derived3 = Cell.derived(() => {
      string += '3';
      return `${source.value} Universe`;
    });
    expect(derived3.value).toBe('Goodbye Universe');
    expect(string).toBe('12123');

    const derived4 = Cell.derived(() => {
      string += '4';
      return derived1.value * 2;
    });
    expect(derived4.value).toBe(14);

    const derived5 = Cell.derived(() => {
      string += '5';
      return `${derived2.value}${derived2.value}`;
    });
    expect(derived5.value).toBe('Goodbye WorldGoodbye World');

    string = '';
    source.value = 'Welcome!';
    expect(string).toBe('12345');
  });

  test('Nested derived cells should only be updated once', () => {
    const cell = Cell.source(1);
    const derived = Cell.derived(() => cell.value + 1);
    const derived2 = Cell.derived(() => cell.value + 3);

    const callback = vi.fn();
    const derived3 = Cell.derived(() => {
      callback();
      return derived.value + derived2.value;
    });

    expect(derived3.value).toBe(6);
    expect(callback).toHaveBeenCalledTimes(1);

    cell.value = 2;

    expect(derived3.value).toBe(8);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('Nested cells', () => {
  test('Cell of object type should be reactive', () => {
    const cell = Cell.source({ a: 1 });
    const cell2 = Cell.source({ b: 10 });

    const derived = Cell.derived(() => cell.value.a + cell2.value.b);

    cell.value.a = 2;
    expect(derived.value).toBe(12);

    cell2.value.b = 20;
    expect(derived.value).toBe(22);
  });

  test('Derived cell of object type should run callback when value changes', () => {
    const cell = Cell.source({ a: 'hello', b: 1, c: true, d: null });
    const callback = vi.fn();

    const derived = Cell.derived(() => {
      callback();
      return cell.value.a;
    });
    expect(derived.value).toBe('hello');
    expect(callback).toHaveBeenCalledTimes(1);

    cell.value = { a: 'world', b: 2, c: false, d: null };
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Cell of map type should be able to read entries', () => {
    const cell = Cell.source(new Map());
    cell.value.set('a', 1);
    cell.value.set('b', 2);

    const array = Cell.derived(() => Array.from(cell.value.entries()));

    cell.value.set('c', 3);
    expect(array.value).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  test('Cell of array type should be reactive', () => {
    const cell = Cell.source([1, 2, 3]);

    const sum = Cell.derived(() => cell.value.reduce((a, b) => a + b, 0));
    expect(sum.value).toBe(6);

    cell.value[0] = 3;
    expect(sum.value).toBe(8);

    cell.value.push(4);
    expect(sum.value).toBe(12);

    cell.value.pop();
    expect(sum.value).toBe(8);
  });

  test('Cell of nested array type should be reactive', () => {
    /** @type {SourceCell<[number, [number, number], number]>} */
    const cell = Cell.source([1, [2, 3], 4], { deep: true });
    const d1 = Cell.derived(() => cell.value[1][1] + 2);
    const d2 = Cell.derived(() => cell.value[1][0] + d1.value);

    expect(d1.value).toBe(5);
    expect(d2.value).toBe(7);
    cell.value[1][1] = 5;

    expect(d1.value).toBe(7);
    expect(d2.value).toBe(9);
  });

  test('Cells of maps should be reactive', () => {
    const cell = Cell.source(new Map());
    const derived = Cell.derived(() => cell.value.get('a'));

    expect(derived.value).toBe(undefined);

    cell.value.set('a', 1);
    expect(derived.value).toBe(1);

    cell.value.set('a', 2);
    expect(derived.value).toBe(2);
  });

  test('Cells of sets should be reactive', () => {
    const cell = Cell.source(new Set());
    const derived = Cell.derived(() => cell.value.has(1));
    const size = Cell.derived(() => cell.value.size);

    expect(derived.value).toBe(false);
    expect(size.value).toBe(0);

    cell.value.add(1);
    expect(derived.value).toBe(true);
    expect(size.value).toBe(1);

    cell.value.add(2);
    expect(derived.value).toBe(true);
    expect(size.value).toBe(2);
  });

  test('Cells of dates should be reactive', () => {
    const cell = Cell.source(new Date());
    const callback = vi.fn();
    cell.listen(callback);

    cell.value = new Date(2022, 1, 1);
    expect(callback).toHaveBeenCalledTimes(1);
    cell.value = new Date(2022, 1, 1);
    expect(callback).toHaveBeenCalledTimes(1);

    cell.value.setMonth(2);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('Cell should handle built-in operators on objects', () => {
    const cell = Cell.source({ a: 1, b: 2 });
    const derived = Cell.derived(() => cell.value.a + cell.value.b);

    cell.value.a += 2;
    expect(derived.value).toBe(5);

    cell.value.b += 2;
    expect(derived.value).toBe(7);

    cell.value.a++;
    expect(derived.value).toBe(8);

    cell.value.b--;
    expect(derived.value).toBe(7);
  });

  test('Cell should handle built-in operators on arrays', () => {
    const cell = Cell.source([1, 2, 3]);
    const derived = Cell.derived(() => cell.value.map((x) => x + 5));

    expect(derived.value).toEqual([6, 7, 8]);

    cell.value[0]++;

    expect(derived.value).toEqual([7, 7, 8]);
  });
});

describe('Batched effects', () => {
  test('Batched effects should run only once', () => {
    const callback = vi.fn();

    const cell = Cell.source(1);
    cell.listen(callback);

    Cell.batch(() => {
      cell.value = 2;
      cell.value = 3;
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Batched derived cells should only be derived once.', () => {
    const callback = vi.fn();

    const cell = Cell.source(2);
    const derived = Cell.derived(() => {
      callback();
      return cell.value * 2;
    });
    expect(derived.value).toEqual(4);

    Cell.batch(() => {
      cell.value = 80;
      cell.value = 100;

      expect(derived.value).toEqual(4);
    });

    expect(callback).toHaveBeenCalled();
    expect(derived.value).toEqual(200);
  });

  test('Batched derived cells should update once regardless of dependencies', () => {
    const cell1 = Cell.source(1);
    const cell2 = Cell.source(2);
    const derived = Cell.derived(() => {
      return cell1.value + cell2.value;
    });
    const callback = vi.fn();
    derived.listen(callback);

    Cell.batch(() => {
      cell1.value = 3;
      cell2.value = 4;

      cell1.value = 5;
      cell2.value = 6;
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(derived.value).toBe(11);
  });

  test('Nested batched effects should still only run once', () => {
    const callback = vi.fn();
    const cell = Cell.source(2);
    cell.listen(callback);

    Cell.batch(() => {
      cell.value = 100;
      cell.value = 90;

      Cell.batch(() => {
        cell.value = 10;
        cell.value = 1;
      });
    });

    expect(callback).toHaveBeenCalled();
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
    cell.value = 2;
    cell.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Immediate effects with signals should be aborted', () => {
    const callback = vi.fn();
    const cell = Cell.source(1);
    const abortController = new AbortController();
    const signal = abortController.signal;
    cell.runAndListen(callback, { signal });
    abortController.abort();
    cell.value = 2; // This should not trigger the callback
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
    const value = Cell.flatten(Cell.derived(() => cell.value));
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
  test('Should work with a simple function', () => {
    const { data, run } = Cell.async(async () => await 1);
    run().then(() => {
      expect(data.value).toBe(1);
    });
  });

  test('Should catch errors in getter function', () => {
    const getter = async () => {
      await true;
      throw new Error('Something went wrong!');
    };

    const { data, error, run } = Cell.async(getter);
    run().then(() => {
      expect(data.value).toBe(null);
      expect(error.value).toHaveProperty('message', 'Something went wrong!');
    });
  });

  test('Should update loading state', () => {
    const getter = async () => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      return true;
    };

    const { data, run, pending } = Cell.async(getter);
    run();
    expect(data.value).toBe(null);
    expect(pending.value).toBe(true);

    setTimeout(() => {
      expect(data.value).toBe(true);
      expect(pending.value).toBe(false);
    }, 4000);
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
    cell.value = 2;
    expect(callback).not.toHaveBeenCalled();
  });

  test('Effects should be removed after the first run if once is true', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { once: true });
    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Effects should not be removed after the first run if once is false', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { once: false });
    cell.value = 2;
    cell.value = 3;
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

    cell.value = 2;

    expect(stream).toBe('Hello, World!');
  });

  test('Effects should throw an error if they are already listening to the cell with the same name', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { name: 'test' });
    expect(() => {
      cell.listen(callback, { name: 'test' });
    }).toThrowError(
      'An effect with the name "test" is already listening to this cell.'
    );
  });

  test('Effects should be able to be stopped', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { name: 'test' });
    cell.stopListeningTo('test');
    cell.value = 2;
    expect(callback).not.toHaveBeenCalled();
  });

  test('Effects should be weakly referenced if specified', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.listen(callback, { weak: true });
    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('Cell options', () => {
  test('Cells should be deeply proxied if specified', () => {
    const cell = Cell.source({ a: 1, b: { c: 5 } }, { deep: true });
    const callback = vi.fn();
    cell.listen(callback);
    cell.value.b.c = 2;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Cells should be shallowly proxied by default', () => {
    const cell = Cell.source({ a: 1, b: { c: 5 } });
    const callback = vi.fn();
    cell.listen(callback);
    cell.value.a = 2;
    expect(callback).toHaveBeenCalledTimes(1);

    cell.value.b.c = 90;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Immutable cells should not allow updates', () => {
    const cell = Cell.source(1, { immutable: true });
    expect(() => {
      cell.value = 2;
    }).toThrowError('Cannot set the value of an immutable cell.');
  });

  test('Cells should use custom equality functions', () => {
    const cell = Cell.source(
      { a: 1, b: 2 },
      {
        equals: (a, b) => a.a === b.a && a.b === b.b,
      }
    );
    const callback = vi.fn();
    cell.listen(callback);
    cell.value = { a: 1, b: 2 };
    expect(callback).toHaveBeenCalledTimes(0);

    cell.value = { a: 1, b: 3 };
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('SourceCell deproxy', () => {
  test('Deproxies should return the original object', () => {
    const original = { a: 1, b: 2 };
    const cell = new SourceCell(original);
    expect(cell.deproxy()).toBe(original);
  });

  test('should throw an error on deproxy if the cell is not an object', () => {
    const cell = new SourceCell(1);
    expect(() => {
      cell.deproxy();
    }).toThrowError('Cannot deproxy a non-object cell.');
  });
});

describe('Derived Cells', () => {
  test('derived cells should be available', () => {
    const s = Cell.source(1);
    const f = Cell.derived(() => s.value + 1);
    expect(f.value).toEqual(2);

    const derived = s.derivedCells;
    expect(derived).toEqual([f]);
  });

  test('derived cells should have dynamic dependencies', () => {
    const a = Cell.source(1);
    const b = Cell.source(2);
    const cb = vi.fn();

    const c = Cell.derived(() => {
      cb();
      if (a.value > 1) {
        return a.value + b.value;
      }
      return a.value;
    });

    expect(c.value).toEqual(1);
    expect(cb).toHaveBeenCalledTimes(1);
    b.value = 10;
    expect(cb).toHaveBeenCalledTimes(1);
    expect(c.value).toEqual(1); // No change.
    a.value = 5;
    expect(cb).toHaveBeenCalledTimes(2);
    expect(c.value).toEqual(15);
    b.value = 20;
    expect(cb).toHaveBeenCalledTimes(3);
    expect(c.value).toEqual(25);
  });
});
