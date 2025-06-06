import { Cell } from '../library/index.js';
import { test } from 'vitest';

const cell = Cell.source(10);
const derived = Cell.derived(() => cell.get() * 2);

test('Compatibility test', () => {
  console.log(derived.get()); // 20
  cell.set(20);
  console.log(derived.get()); // 40
});
