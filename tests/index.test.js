import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Cell, SourceCell } from '../library/index.js';

beforeEach(() => {
  Cell.removeGlobalEffects();
});

describe('Cells', () => {
  test('Creates a reactive Cell of type T', () => {
    const cell = Cell.source(1);
    expect(cell.value).toBe(1);
  });

  test('Cell should be reactive', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    cell.subscribe(callback);
    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });

  test('Cell should handle built-in operators', () => {
    const cell = Cell.source(1);
    const callback = vi.fn();
    const unsubscribe = cell.subscribe(callback);
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
    const unsubscribe1 = cell.subscribe(callback1);
    const unsubscribe2 = cell.subscribe(callback2);
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
    const unsubscribe = cell.subscribe(callback);
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
    const unsubscribe1 = cell.subscribe(callback1);
    const unsubscribe2 = cell.subscribe(callback2);
    const unsubscribe3 = cell.subscribe(callback3);
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

describe('Global Effects', () => {
  test('Global effects should run on all cells', () => {
    const callback = vi.fn();
    Cell.beforeUpdate(callback);
    const cell = Cell.source(1);
    expect(callback).toHaveBeenCalledTimes(0);

    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);

    const derived = Cell.derived(() => cell.value + 1);
    cell.value = 20;

    expect(callback).toHaveBeenCalledTimes(3);
  });

  test('Global effects set to run once should only run once', () => {
    const callback = vi.fn();
    Cell.beforeUpdate(callback, {
      runOnce: true,
    });
    const cell = Cell.source(1);
    cell.value = 2;

    expect(callback).toHaveBeenCalledTimes(1);

    cell.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Global effects run before', () => {
    Cell.beforeUpdate(
      () => {
        expect(cell.value).toBe(1);
        expect(derived.value).toBe(3);
      },
      {
        ignoreDerivedCells: true,
      }
    );
    const cell = Cell.source(1);
    const derived = Cell.derived(() => cell.value * 3);
    cell.value = 8;
  });

  test('Global effects run after', () => {
    Cell.afterUpdate(() => {
      expect(cell.value).toBe(2);
    });

    const cell = Cell.source(1);
    cell.value = 2;
  });

  test('Global effects set to ignore derived cells should ignore derived cells', () => {
    const callback = vi.fn();
    Cell.beforeUpdate(callback, {
      ignoreDerivedCells: true,
    });
    const cell = Cell.source(1);
    const derived = Cell.derived(() => cell.value + 1);

    cell.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(derived.value).toBe(3);
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
    derived.subscribe(callback);
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
    derived.subscribe(callback);
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
    cell.subscribe(callback);

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
    derived2.subscribe(callback);
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
    derived2.subscribe(callback);

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
    const unsubscribe1 = derived.subscribe(callback1);
    const unsubscribe2 = derived.subscribe(callback2);
    const unsubscribe3 = derived.subscribe(callback3);
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
    const cell = Cell.source([1, [2, 3], 4]);
    const d1 = Cell.derived(() => cell.value[1][1] + 2);
    const d2 = Cell.derived(() => cell.value[1][0] + d1.value);

    expect(d1.value).toBe(5);
    expect(d2.value).toBe(7);
    cell.value[1][1] = 5;

    expect(d1.value).toBe(7);
    expect(d2.value).toBe(9);
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
    cell.subscribe(callback);

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

    Cell.batch(() => {
      cell.value = 80;
      cell.value = 100;

      expect(derived.value).toEqual(4);
    });

    expect(callback).toHaveBeenCalled();
    expect(derived.value).toEqual(200);
  });

  test('Nested batched effects should still only run once', () => {
    const callback = vi.fn();
    const cell = Cell.source(2);
    cell.subscribe(callback);

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
    cell.runAndSubscribe(callback);
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
