# Cells

[![npm version](https://badge.fury.io/js/%40adbl%2Fcells.svg)](https://badge.fury.io/js/%40adbl%2Fcells)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Introduction

Cells is a lightweight library for reactive state management in JavaScript applications. It handles data flows and propagates changes throughout your application, simplifying the development of interactive interfaces.

## Key Features

- Simple API for reactive programming concepts
- Automatic updates of dependent computations and side effects
- Composable architecture using built-in operators
- Lightweight with no external dependencies
- Type-safe with type inference and checking
- Local and global effect management
- Support for asynchronous operations

## Installation

To add Cells to your project, simply run:

```bash
npm install @adbl/cells
```

or if you're using Yarn:

```bash
yarn add @adbl/cells
```

## Basic Usage

### Creating a Source Cell

A source cell is the foundation of reactivity in Cells. It holds a value that can be updated over time:

```javascript
import { Cell } from '@adbl/cells';

const count = Cell.source(0);
console.log(count.value); // Output: 0

count.value = 5;
console.log(count.value); // Output: 5
```

### Creating a Derived Cell

Derived cells compute their values based on other cells:

```javascript
const count = Cell.source(0);
const doubledCount = Cell.derived(() => count.value * 2);

console.log(doubledCount.value); // Output: 0

count.value = 5;
console.log(doubledCount.value); // Output: 10
```

### Listening for Changes

You can easily set up listeners to react to changes in cell values:

```javascript
const count = Cell.source(0);

count.listen((newValue) => {
  console.log(`Count changed to: ${newValue}`);
});

count.value = 3; // Output: "Count changed to: 3"
count.value = 7; // Output: "Count changed to: 7"
```

## Other Features

### Global Effects

Cells allows you to set up global effects that run before or after any cell is updated:

```javascript
Cell.beforeUpdate((value) => {
  console.log(`About to update a cell with value: ${value}`);
});

Cell.afterUpdate((value) => {
  console.log(`Just updated a cell with value: ${value}`);
});

const myCell = Cell.source(0);
myCell.value = 42;
// Output:
// "About to update a cell with value: 42"
// "Just updated a cell with value: 42"
```

### Batch Updates

When you need to perform multiple updates but only want to trigger effects once, you can use batch updates:

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

### Async Operations

Cells provides utilities for handling asynchronous operations:

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

## Best Practices

1. **Keep Cells Simple**: Try to keep each cell focused on a single piece of state or computation. This makes your code easier to understand and maintain.

2. **Use Derived Cells for Computed Values**: Instead of manually updating dependent values, use derived cells to automatically compute and update values based on other cells.

3. **Avoid Circular Dependencies**: Be cautious when creating derived cells to avoid circular dependencies, which can lead to infinite update loops.

4. **Use Batch Updates Wisely**: When performing multiple related updates, use `Cell.batch()` to optimize performance and prevent unnecessary re-renders.

5. **Clean Up Listeners**: When using `listen()` in components or objects with a lifecycle, make sure to clean up the listeners when they're no longer needed to prevent memory leaks.

## Advanced Concepts

### Flattening

Cells provides utility functions for working with nested cell structures:

```javascript
const nestedCell = Cell.source(Cell.source(5));
const flattenedValue = Cell.flatten(nestedCell);
console.log(flattenedValue); // Output: 5
```

### Custom Equality Checks

By default, Cells uses strict equality (`===`) to determine if a value has changed. You can provide custom equality functions for more complex objects:

```javascript
const userCell = Cell.source(
  { name: 'Alice', age: 30 },
  {
    equals: (a, b) => a.name === b.name && a.age === b.age,
  }
);
userCell.listen((newUser) => console.log('User updated:', newUser));

// This update won't trigger the listener because the values are the same
userCell.value = { name: 'Alice', age: 30 };

// This update will trigger the listener
userCell.value = { name: 'Bob', age: 35 };
```

### Debugging

To aid in debugging, you can name your effects:

```javascript
const count = Cell.source(0);

count.listen((value) => console.log(`Count is now: ${value}`), {
  name: 'countLogger',
});

// Later, you can check if this named effect is still active
console.log(count.isListeningTo('countLogger')); // Output: true
```

## Contributing

Contributions to Cells are welcome! Whether it's bug reports, feature requests, or code contributions, please feel free to get involved.

## License

Cells is released under the MIT License. See the [LICENSE](LICENSE) file for more details.
