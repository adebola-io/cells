# @adbl/cells

[![npm version](https://badge.fury.io/js/%40adbl%2Fcells.svg)](https://badge.fury.io/js/%40adbl%2Fcells)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Cells is a powerful yet lightweight library for reactive state management in JavaScript applications. It offers an intuitive API that simplifies the complexities of managing and propagating state changes throughout your application.

## Features

- **Simple API**: Easy to learn and use, even for developers new to reactive programming.
- **Lightweight**: No external dependencies, keeping your project lean.
- **Flexible**: Works seamlessly with any JavaScript framework or vanilla JS.
- **Type-safe**: Built with TypeScript, providing excellent type inference and checking.
- **Performant**: Optimized for efficiency, with features like batched updates to minimize unnecessary computations.

## Installation

Get started with Cells in your project:

```bash
npm install @adbl/cells
```

Or if you prefer Yarn:

```bash
yarn add @adbl/cells
```

## Core Concepts

### 1. Source Cells

Source cells are the building blocks of your reactive state. They hold values that can change over time, automatically notifying dependents when updates occur.

```javascript
import { Cell } from '@adbl/cells';

const count = Cell.source(0);
console.log(count.value); // Output: 0

count.value = 5;
console.log(count.value); // Output: 5
```

### 2. Derived Cells

Derived cells allow you to create computed values based on other cells. They update automatically when their dependencies change, ensuring your derived state is always in sync.

```javascript
const count = Cell.source(0);
const doubledCount = Cell.derived(() => count.value * 2);

console.log(doubledCount.value); // Output: 0

count.value = 5;
console.log(doubledCount.value); // Output: 10
```

### 3. Reactive Effects

Easily set up listeners to react to changes in cell values, allowing you to create side effects or update your UI in response to state changes.

```javascript
const count = Cell.source(0);

count.listen((newValue) => {
  console.log(`Count changed to: ${newValue}`);
});

count.value = 3; // Output: "Count changed to: 3"
count.value = 7; // Output: "Count changed to: 7"
```

### 4. Global Effects

Cells allows you to set up global effects that run before or after any cell is updated, giving you fine-grained control over your application's reactive behavior.

```javascript
Cell.beforeUpdate((value) => {
  console.log(`About to update a cell with value: ${value}`);
});

Cell.afterUpdate((value) => {
  console.log(`Just updated a cell with value: ${value}`);
});
```

### 5. Batch Updates

When you need to perform multiple updates but only want to trigger effects once, you can use batch updates to optimize performance:

```javascript
const cell1 = Cell.source(0);
const cell2 = Cell.source(0);

Cell.afterUpdate(() => {
  console.log('Update occurred');
});

Cell.batch(() => {
  cell1.value = 1;
  cell2.value = 2;
});
// Output: "Update occurred" (only once)
```

### 6. Async Operations

Cells provides utilities for handling asynchronous operations, making it easy to manage loading states, data, and errors:

```javascript
const fetchUser = Cell.async(async (userId) => {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  return response.json();
});

const { pending, data, error, run } = fetchUser;

pending.listen((isPending) => {
  console.log(isPending ? 'Loading...' : 'Done!');
});

data.listen((userData) => {
  if (userData) {
    console.log('User data:', userData);
  }
});

run(123); // Triggers the async operation
```

### 7. Flattening

Cells offers utility functions to work with nested cell structures, making it easier to handle complex state shapes:

```javascript
const nestedCell = Cell.source(Cell.source(5));
const flattenedValue = Cell.flatten(nestedCell);
console.log(flattenedValue); // Output: 5

const arrayOfCells = [Cell.source(1), Cell.source(2), Cell.source(3)];
const flattenedArray = Cell.flattenArray(arrayOfCells);
console.log(flattenedArray); // Output: [1, 2, 3]

const objectWithCells = { a: Cell.source(1), b: Cell.source(2) };
const flattenedObject = Cell.flattenObject(objectWithCells);
console.log(flattenedObject); // Output: { a: 1, b: 2 }
```

### 8. Custom Equality Checks

For more complex objects, you can provide custom equality functions to determine when a cell's value has truly changed:

```javascript
const userCell = Cell.source(
  { name: 'Alice', age: 30 },
  {
    equals: (a, b) => a.name === b.name && a.age === b.age,
  }
);
```

### 9. Named Effects

To aid in debugging, you can name your effects, making it easier to track and manage them:

```javascript
const count = Cell.source(0);

count.listen((value) => console.log(`Count is now: ${value}`), {
  name: 'countLogger',
});

console.log(count.isListeningTo('countLogger')); // Output: true

count.stopListeningTo('countLogger');
```

## Advanced Features and API Details

### Cell Options

When creating a source cell, you have fine-grained control over its behavior:

```javascript
const cell = Cell.source(initialValue, {
  immutable: boolean, // If true, the cell will not allow updates
  shallowProxied: boolean, // If true, only top-level properties are proxied
  equals: (oldValue, newValue) => boolean, // Custom equality function
});
```

### Effect Options

When setting up listeners or effects, you can customize their behavior:

```javascript
cell.listen(callback, {
  once: boolean, // If true, the effect will only run once
  signal: AbortSignal, // An AbortSignal to cancel the effect
  name: string, // A name for the effect (useful for debugging)
  priority: number, // The priority of the effect (higher priority effects run first)
});
```
