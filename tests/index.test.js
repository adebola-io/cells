import { expect, test, vi } from 'vitest';
import { Signal } from '../library/index.js';

test('Creates a reactive Cell of type T', () => {
  const cell = Signal.cell(1);
  expect(cell.value).toBe(1);
});

test('Cell should be reactive', () => {
  const cell = Signal.cell(1);
  const callback = vi.fn();
  cell.subscribe(callback);
  cell.value = 2;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(2);
});

test('Cell should handle unsubscribe', () => {
  const cell = Signal.cell(1);
  const callback = vi.fn();
  const unsubscribe = cell.subscribe(callback);
  cell.value = 2;
  expect(callback).toHaveBeenCalledTimes(1);
  unsubscribe();
  cell.value = 3;
  expect(callback).toHaveBeenCalledTimes(1);
});

test('Cell should handle nested subscriptions', () => {
  const cell = Signal.cell(1);
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

test('Cell should handle multiple subscriptions and unsubscriptions', () => {
  const cell = Signal.cell(1);
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

test('Creates a reactive Derived of type T', () => {
  const cell1 = Signal.cell(1);
  const cell2 = Signal.cell(2);
  const derived = Signal.derived(() => cell1.value + cell2.value);
  expect(derived.value).toBe(3);

  console.log(derived.valueOf());
});

test('Derived should be reactive', () => {
  const cell1 = Signal.cell(1);
  const cell2 = Signal.cell(2);
  const derived = Signal.derived(() => cell1.value + cell2.value);
  const callback = vi.fn();
  derived.subscribe(callback);
  cell1.value = 3;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(5);

  const name = Signal.cell('John');
  const surname = Signal.cell('Smith');
  const fullname = Signal.derived(() => `${name.value} ${surname.value}`);
  expect(fullname.value).toBe('John Smith');

  name.value = 'Jane';
  expect(fullname.value).toBe('Jane Smith');
});

test('Derived should handle multiple dependencies', () => {
  const cell1 = Signal.cell(1);
  const cell2 = Signal.cell(2);
  const cell3 = Signal.cell(3);
  const derived = Signal.derived(() => cell1.value + cell2.value + cell3.value);
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

test('Derived should handle nested dependencies', () => {
  const cell1 = Signal.cell(1);
  const cell2 = Signal.cell(2);
  const derived1 = Signal.derived(() => cell1.value + cell2.value);
  const derived2 = Signal.derived(() => derived1.value * 2);
  const callback = vi.fn();
  derived2.subscribe(callback);
  cell1.value = 3;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(10);
  cell2.value = 4;
  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback).toHaveBeenCalledWith(14);
});

test('Derived should handle circular dependencies', () => {
  const cell1 = Signal.cell(1);
  const cell2 = Signal.cell(2); // 4
  const derived1 = Signal.derived(() => cell2.value + 1);
  const derived2 = Signal.derived(() => derived1.value + cell1.value);

  cell2.value = derived2.value;
  expect(cell2.value).toBe(4);
  expect(derived2.value).toBe(6);

  const callback = vi.fn();
  derived2.subscribe(callback);

  cell1.value = 3;

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(8);
});

test('Derived should handle multiple subscriptions and unsubscriptions', () => {
  const cell1 = Signal.cell(1);
  const cell2 = Signal.cell(2);
  const derived = Signal.derived(() => cell1.value + cell2.value);
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

test('Cell of object type should be reactive', () => {
  const cell = Signal.cell({ a: 1 });
  const cell2 = Signal.cell({ b: 10 });

  const derived = Signal.derived(() => cell.value.a + cell2.value.b);

  cell.value.a = 2;
  expect(derived.value).toBe(12);

  cell2.value.b = 20;
  expect(derived.value).toBe(22);
});

test('Cell of array type should be reactive', () => {
  const cell = Signal.cell([1, 2, 3]);

  const sum = Signal.derived(() => cell.value.reduce((a, b) => a + b, 0));
  expect(sum.value).toBe(6);

  cell.value[0] = 3;
  expect(sum.value).toBe(8);

  cell.value.push(4);
  expect(sum.value).toBe(12);

  cell.value.pop();
  expect(sum.value).toBe(8);
});

test('Cell of nested array type should be reactive', () => {
  /** @type {ReturnType<typeof Signal.cell<[number, [number, number], number]>>} */
  const cell = Signal.cell([1, [2, 3], 4]);
  const hiddenDerived = Signal.derived(() => cell.value[1][1] + 2);
  const secondLevelDerived = Signal.derived(
    () => cell.value[1][0] + hiddenDerived.value
  );

  expect(hiddenDerived.value).toBe(5);
  expect(secondLevelDerived.value).toBe(7);
  cell.value[1][1] = 5;

  expect(hiddenDerived.value).toBe(7);
  expect(secondLevelDerived.value).toBe(9);
});

test('Cell should handle built-in operators', () => {
  const cell = Signal.cell(1);
  const callback = vi.fn();
  const unsubscribe = cell.subscribe(callback);
  cell.value += 2;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(3);
  unsubscribe();
});

test('Cell should handle built-in operators on objects', () => {
  const cell = Signal.cell({ a: 1, b: 2 });
  const derived = Signal.derived(() => cell.value.a + cell.value.b);

  cell.value.a += 2;
  expect(derived.value).toBe(5);

  cell.value.b += 2;
  expect(derived.value).toBe(7);

  cell.value.a++;
  expect(derived.value).toBe(8);

  cell.value.b--;
  expect(derived.value).toBe(7);
});