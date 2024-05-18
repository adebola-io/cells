import { expect, test, vi } from 'vitest';
import { Signal } from '../library/index.js';

test('Creates a reactive Cell of type T', () => {
  const cell = new Signal.Cell(1);
  expect(cell.value).toBe(1);
});

test('Cell should be reactive', () => {
  const cell = new Signal.Cell(1);
  const callback = vi.fn();
  cell.subscribe(callback);
  cell.value = 2;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(2);
});

test('Cell should handle unsubscribe', () => {
  const cell = new Signal.Cell(1);
  const callback = vi.fn();
  const unsubscribe = cell.subscribe(callback);
  cell.value = 2;
  expect(callback).toHaveBeenCalledTimes(1);
  unsubscribe();
  cell.value = 3;
  expect(callback).toHaveBeenCalledTimes(1);
});

test('Cell should handle nested subscriptions', () => {
  const cell = new Signal.Cell(1);
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
  const cell = new Signal.Cell(1);
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

test('Derived should be reactive', () => {
  const cell1 = new Signal.Cell(1);
  const cell2 = new Signal.Cell(2);
  const derived = new Signal.Derived(() => cell1.value + cell2.value);
  const callback = vi.fn();
  derived.subscribe(callback);
  cell1.value = 3;
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(5);
});

test('Derived should handle multiple dependencies', () => {
  const cell1 = new Signal.Cell(1);
  const cell2 = new Signal.Cell(2);
  const cell3 = new Signal.Cell(3);
  const derived = new Signal.Derived(
    () => cell1.value + cell2.value + cell3.value
  );
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
  const cell1 = new Signal.Cell(1);
  const cell2 = new Signal.Cell(2);
  const derived1 = new Signal.Derived(() => cell1.value + cell2.value);
  const derived2 = new Signal.Derived(() => derived1.value * 2);
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
  const cell1 = new Signal.Cell(1);
  const cell2 = new Signal.Cell(2); // 4
  const derived1 = new Signal.Derived(() => cell2.value + 1);
  const derived2 = new Signal.Derived(() => derived1.value + cell1.value);

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
  const cell1 = new Signal.Cell(1);
  const cell2 = new Signal.Cell(2);
  const derived = new Signal.Derived(() => cell1.value + cell2.value);
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
