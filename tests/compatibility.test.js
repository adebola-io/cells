import { Signal } from '../library/index.js';

const signal = Signal.source(10);
const derived = Signal.derived(() => signal.value * 2);

console.log(derived.value); // 20
signal.value = 20;
console.log(derived.value); // 40
