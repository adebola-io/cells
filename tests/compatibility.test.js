import { Cell } from '../library/index.js';
import { test } from 'vitest';

const cell = Cell.source(10);
const derived = Cell.derived(() => cell.value * 2);

test('Compatibility test', () => {
  console.log(derived.value); // 20
  cell.value = 20;
  console.log(derived.value); // 40
});
