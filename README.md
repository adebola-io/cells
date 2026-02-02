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
console.log(count.get()); // Output: 0

count.set(5);
console.log(count.get()); // Output: 5
```

### 2. Derived Cells

Derived cells allow you to create computed values based on other cells. They update automatically when their dependencies change, ensuring your derived state is always in sync.

```javascript
const count = Cell.source(0);
const doubledCount = Cell.derived(() => count.get() * 2);

console.log(doubledCount.get()); // Output: 0

count.set(5);
console.log(doubledCount.get()); // Output: 10
```

### 3. Reactive Effects

Easily set up listeners to react to changes in cell values, allowing you to create side effects or update your UI in response to state changes.

```javascript
const count = Cell.source(0);

count.listen((newValue) => {
  console.log(`Count changed to: ${newValue}`);
});

count.set(3); // Output: "Count changed to: 3"
count.set(7); // Output: "Count changed to: 7"
```

### 4. Batch Updates

When you need to perform multiple updates but only want to trigger effects once, you can use batch updates to optimize performance:

```javascript
const cell1 = Cell.source(0);
const cell2 = Cell.source(0);

const callback = () => {
  console.log('Update occurred');
};

cell1.listen(callback);
cell2.listen(callback);

Cell.batch(() => {
  cell1.set(1);
  cell2.set(2);
});
// Output: "Update occurred" (only once)
```

### 5. Custom Equality Checks

For more complex objects, you can provide custom equality functions to determine when a cell's value has truly changed:

```javascript
const userCell = Cell.source(
  { name: 'Alice', age: 30 },
  {
    equals: (a, b) => a.name === b.name && a.age === b.age,
  }
);
```

### 6. Named Effects

To aid in debugging, you can name your effects, making it easier to track and manage them:

```javascript
const count = Cell.source(0);

count.listen((value) => console.log(`Count is now: ${value}`), {
  name: 'countLogger',
});

console.log(count.isListeningTo('countLogger')); // Output: true

count.stopListeningTo('countLogger');
```

## Features and API Details

### Async Derived Cells

While `Cell.derived` is for synchronous transformations, `Cell.derivedAsync` handles asynchronous logic like data fetching or complex computations. It behaves like its synchronous counterpart but manages the complexities of timing, errors, and cancellation.

#### Key Differences from `Cell.derived`

- **Computed Value**: `Cell.derived` returns a value; `Cell.derivedAsync` manages a `Promise`.
- **Status Tracking**: Async cells provide `.pending` (loading state) and `.error` cells natively.
- **Non-Blocking**: Updating a dependency doesn't block the UI; the cell simply enters a `pending` state while it works in the background.

#### Usage

```javascript
const userId = Cell.source(1);

const profile = Cell.derivedAsync(async (get, signal) => {
  const id = get(userId); // Automatically tracks userId
  const response = await fetch(`/api/users/${id}`, { signal });
  return response.json();
});

// Reacting to the state
profile.pending.listen((loading) =>
  console.log(loading ? 'Loading...' : 'Ready')
);
profile.error.listen((err) => err && console.error('Fetch failed:', err));

// Getting the value:
const data = await profile.get();
```

#### Behavior

- **Orchestration**: If a dependency is another async cell, calling `await get(dependency)` ensures the library waits for the parent to finish before starting the current computation.
- **Cancellation**: If dependencies change while a computation is in-flight, the provided `signal` is aborted and the computation is restarted with fresh inputs.
- **Consistency**: The library performs a deep equality check on results. If a parent finishes but its value hasn't changed, dependent children will not re-run.
- **Resilience**: If a computation fails, the `error` cell is updated, but `get()` continues to provide the last successful value to keep the UI stable.

#### Composition (Chaining)

Multiple async cells can be chained together. The library handles the synchronization between them automatically.

```javascript
const posts = Cell.derivedAsync(async (get, signal) => {
  // Wait for the 'profile' cell to resolve first
  const userData = await get(profile);
  const response = await fetch(`/api/posts?email=${userData.email}`, {
    signal,
  });
  return response.json();
});
```

#### API Summary

- **`pending`**: `Cell<boolean>` - `true` during active computation.
- **`error`**: `Cell<Error | null>` - The last error encountered.
- **`get()`**: Returns a `Promise` that resolves to the current value once the cell (and its ancestors) are stable.
- **`peek()`**: Same as `get()`, but does not register the cell as a dependency of the caller.
- **`revalidate()`**: Manually triggers a recomputation of the async cell, aborting any in-flight computation.

#### Callback Signature

The callback receives two parameters:

- `get(cell)`: Reads a cell's value and tracks it as a dependency. If the target is an async cell, it returns a `Promise`.
- `signal`: An `AbortSignal` that triggers when the computation becomes obsolete (e.g., a dependency changed).

### Cell Options

When creating a source cell, you have fine-grained control over its behavior:

```javascript
const cell = Cell.source(initialValue, {
  immutable: boolean, // If true, the cell will not allow updates
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

### Explicit Disposal (Contexts)

By default, Cells uses `WeakRef` and Garbage Collection to manage memory. This is easy to use but can lead to "ghost computations", where listeners and derived cells keep running for a short time after they are no longer needed.

For high-performance scenarios, you can use a `LocalContext` to group dependencies and kill them synchronously.

```javascript
const ctx = Cell.context();
const source = Cell.source(1);

Cell.runWithContext(ctx, () => {
  // This listener is now bound to 'ctx' (Strong Reference)
  source.listen((val) => console.log(val));
});

source.set(2); // Logs: 2

// Synchronously remove all listeners created in that block
ctx.destroy();

source.set(3); // Nothing happens
```
