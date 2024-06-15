import { Signal } from '../library/index.js';
import { test } from 'vitest';

const signal = Signal.source(10);
const derived = Signal.derived(() => signal.value * 2);

test('Compatibility test', () => {
  console.log(derived.value); // 20
  signal.value = 20;
  console.log(derived.value); // 40
});
