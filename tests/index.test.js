import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Signal } from '../library/index.js';

beforeEach(() => {
  Signal.removeGlobalEffects();
});

describe('Signals', () => {
  test('Creates a reactive Signal of type T', () => {
    const signal = Signal.source(1);
    expect(signal.value).toBe(1);
  });

  test('Signal should be reactive', () => {
    const signal = Signal.source(1);
    const callback = vi.fn();
    signal.createEffect(callback);
    signal.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });

  test('Signal should handle built-in operators', () => {
    const signal = Signal.source(1);
    const callback = vi.fn();
    const unsubscribe = signal.createEffect(callback);
    signal.value += 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3);
    unsubscribe();
  });
});

describe('Effects', () => {
  test('Signal should handle nested subscriptions', () => {
    const signal = Signal.source(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const unsubscribe1 = signal.createEffect(callback1);
    const unsubscribe2 = signal.createEffect(callback2);
    signal.value = 2;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith(2);
    unsubscribe1();
    signal.value = 3;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledWith(3);
    unsubscribe2();
  });

  test('Signal should handle unsubscribe', () => {
    const signal = Signal.source(1);
    const callback = vi.fn();
    const unsubscribe = signal.createEffect(callback);
    signal.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    signal.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Signal should handle multiple subscriptions and un-subscriptions', () => {
    const signal = Signal.source(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const unsubscribe1 = signal.createEffect(callback1);
    const unsubscribe2 = signal.createEffect(callback2);
    const unsubscribe3 = signal.createEffect(callback3);
    signal.value = 2;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    unsubscribe2();
    signal.value = 3;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
    unsubscribe1();
    unsubscribe3();
    signal.value = 4;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
  });
});

describe('Global Effects', () => {
  test('Global effects should run on all signals', () => {
    const callback = vi.fn();
    Signal.beforeUpdate(callback);
    const signal = Signal.source(1);
    expect(callback).toHaveBeenCalledTimes(0);

    signal.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);

    const derived = Signal.derived(() => signal.value + 1);
    signal.value = 20;

    expect(callback).toHaveBeenCalledTimes(3);
  });

  test('Global effects set to run once should only run once', () => {
    const callback = vi.fn();
    Signal.beforeUpdate(callback, {
      runOnce: true,
    });
    const signal = Signal.source(1);
    signal.value = 2;

    expect(callback).toHaveBeenCalledTimes(1);

    signal.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Global effects run before', () => {
    Signal.beforeUpdate(
      () => {
        expect(signal.value).toBe(1);
        expect(derived.value).toBe(3);
      },
      {
        ignoreDerivedSignals: true,
      }
    );
    const signal = Signal.source(1);
    const derived = Signal.derived(() => signal.value * 3);
    signal.value = 8;
  });

  test('Global effects run after', () => {
    Signal.afterUpdate(() => {
      expect(signal.value).toBe(2);
    });

    const signal = Signal.source(1);
    signal.value = 2;
  });

  test('Global effects set to ignore derived signals should ignore derived signals', () => {
    const callback = vi.fn();
    Signal.beforeUpdate(callback, {
      ignoreDerivedSignals: true,
    });
    const signal = Signal.source(1);
    const derived = Signal.derived(() => signal.value + 1);

    signal.value = 2;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(derived.value).toBe(3);
  });
});

describe('Derived signals', () => {
  test('Creates a reactive Derived signal of type T', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2);
    const derived = Signal.derived(() => signal1.value + signal2.value);
    expect(derived.value).toBe(3);
  });

  test('Derived signal objects should be reactive', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2);
    const derived = Signal.derived(() => ({
      a: signal1.value + signal2.value,
    }));
    const a = Signal.derived(() => derived.value.a);
    expect(derived.value).toEqual({ a: 3 });

    signal1.value = 3;
    expect(a.value).toEqual(5);
  });

  test('Derived signal should be reactive', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2);
    const derived = Signal.derived(() => signal1.value + signal2.value);
    const callback = vi.fn();
    derived.createEffect(callback);
    signal1.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(5);

    const name = Signal.source('John');
    const surname = Signal.source('Smith');
    const fullname = Signal.derived(() => `${name.value} ${surname.value}`);
    expect(fullname.value).toBe('John Smith');

    name.value = 'Jane';
    expect(fullname.value).toBe('Jane Smith');
  });

  test('Derived signal should handle multiple dependencies', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2);
    const signal3 = Signal.source(3);
    const derived = Signal.derived(
      () => signal1.value + signal2.value + signal3.value
    );
    const callback = vi.fn();
    derived.createEffect(callback);
    signal1.value = 4;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(9);
    signal2.value = 5;
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(12);
    signal3.value = 6;
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith(15);
  });

  test('Derived signals should not depend on same signal multiple times', () => {
    const signal = Signal.source(1);
    const callback = vi.fn();
    signal.createEffect(callback);

    const derived1 = Signal.derived(() => signal.value + signal.value);
    expect(derived1.value).toBe(2);

    signal.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Derived signal should handle nested dependencies', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2);
    const derived1 = Signal.derived(() => signal1.value + signal2.value);
    const derived2 = Signal.derived(() => derived1.value * 2);
    const callback = vi.fn();
    derived2.createEffect(callback);
    signal1.value = 3;
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
    signal2.value = 4;
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(14);
  });

  test('Derived signal should handle circular dependencies', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2); // 4
    const derived1 = Signal.derived(() => signal2.value + 1);
    const derived2 = Signal.derived(() => derived1.value + signal1.value);

    signal2.value = derived2.value;
    expect(signal2.value).toBe(4);
    expect(derived2.value).toBe(6);

    const callback = vi.fn();
    derived2.createEffect(callback);

    signal1.value = 3;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(8);
  });

  test('Derived signal should handle multiple subscriptions and unsubscriptions', () => {
    const signal1 = Signal.source(1);
    const signal2 = Signal.source(2);
    const derived = Signal.derived(() => signal1.value + signal2.value);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const unsubscribe1 = derived.createEffect(callback1);
    const unsubscribe2 = derived.createEffect(callback2);
    const unsubscribe3 = derived.createEffect(callback3);
    signal1.value = 3;
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    unsubscribe2();
    signal2.value = 4;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
    unsubscribe1();
    unsubscribe3();
    signal1.value = 5;
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(2);
  });
});

describe('Nested signals', () => {
  test('Signal of object type should be reactive', () => {
    const signal = Signal.source({ a: 1 });
    const signal2 = Signal.source({ b: 10 });

    const derived = Signal.derived(() => signal.value.a + signal2.value.b);

    signal.value.a = 2;
    expect(derived.value).toBe(12);

    signal2.value.b = 20;
    expect(derived.value).toBe(22);
  });

  test('Signal of array type should be reactive', () => {
    const signal = Signal.source([1, 2, 3]);

    const sum = Signal.derived(() => signal.value.reduce((a, b) => a + b, 0));
    expect(sum.value).toBe(6);

    signal.value[0] = 3;
    expect(sum.value).toBe(8);

    signal.value.push(4);
    expect(sum.value).toBe(12);

    signal.value.pop();
    expect(sum.value).toBe(8);
  });

  test('Signal of nested array type should be reactive', () => {
    /** @type {SourceSignal<[number, [number, number], number]>} */
    const signal = Signal.source([1, [2, 3], 4]);
    const d1 = Signal.derived(() => signal.value[1][1] + 2);
    const d2 = Signal.derived(() => signal.value[1][0] + d1.value);

    expect(d1.value).toBe(5);
    expect(d2.value).toBe(7);
    signal.value[1][1] = 5;

    expect(d1.value).toBe(7);
    expect(d2.value).toBe(9);
  });

  test('Signal should handle built-in operators on objects', () => {
    const signal = Signal.source({ a: 1, b: 2 });
    const derived = Signal.derived(() => signal.value.a + signal.value.b);

    signal.value.a += 2;
    expect(derived.value).toBe(5);

    signal.value.b += 2;
    expect(derived.value).toBe(7);

    signal.value.a++;
    expect(derived.value).toBe(8);

    signal.value.b--;
    expect(derived.value).toBe(7);
  });

  test('Signal should handle built-in operators on arrays', () => {
    const signal = Signal.source([1, 2, 3]);
    const derived = Signal.derived(() => signal.value.map((x) => x + 5));

    expect(derived.value).toEqual([6, 7, 8]);

    signal.value[0]++;

    expect(derived.value).toEqual([7, 7, 8]);
  });
});

describe('Batched effects', () => {
  test('Batched effects should run only once', () => {
    const callback = vi.fn();

    const signal = Signal.source(1);
    signal.createEffect(callback);

    Signal.batch(() => {
      signal.value = 2;
      signal.value = 3;
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('Batched derived signals should only be derived once.', () => {
    const callback = vi.fn();

    const signal = Signal.source(2);
    const derived = Signal.derived(() => {
      callback();
      return signal.value * 2;
    });

    Signal.batch(() => {
      signal.value = 80;
      signal.value = 100;

      expect(derived.value).toEqual(4);
    });

    expect(callback).toHaveBeenCalled(1);
    expect(derived.value).toEqual(200);
  });

  test('Nested batched effects should still only run once', () => {
    const callback = vi.fn();
    const signal = Signal.source(2);
    signal.createEffect(callback);

    Signal.batch(() => {
      signal.value = 100;
      signal.value = 90;

      Signal.batch(() => {
        signal.value = 10;
        signal.value = 1;
      });
    });

    expect(callback).toHaveBeenCalled(1);
  });
});

describe('Immediate effects', () => {
  test('Immediate effects should run immediately', () => {
    const callback = vi.fn();
    const signal = Signal.source(1);
    signal.createImmediateEffect(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
