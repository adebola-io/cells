# @adbl/cells

[![npm version](https://badge.fury.io/js/%40adbl%2Fcells.svg)](https://badge.fury.io/js/%40adbl%2Fcells)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, type-safe library for reactive state management. Cells simplifies complex state propagation with an intuitive API that handles synchronous updates, asynchronous data fetching, and race conditions automatically.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Guide](#guide)
  - [Core Concepts](#1-core-concepts)
  - [Asynchronous State](#2-asynchronous-state)
  - [Advanced Patterns](#3-advanced-patterns)
- [API Reference](#api-reference)
- [TypeScript Support](#typescript-support)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Fine-grained Reactivity** - Updates only what changes, avoiding unnecessary re-renders
- **Async Primitives** - First-class support for async state with built-in loading and error tracking
- **Race Condition Handling** - Automatically cancels stale async requests via `AbortSignal`
- **Glitch-free** - Guarantees consistency across derived values with topological update ordering
- **Type-safe** - Full TypeScript support with inferred types
- **Zero Dependencies** - Keeps your bundle small (~3KB minified)

## Installation

```bash
npm install @adbl/cells
```

```bash
yarn add @adbl/cells
```

```bash
pnpm add @adbl/cells
```

## Quick Start

```javascript
import { Cell } from '@adbl/cells';

// 1. Create a source cell
const name = Cell.source('World');

// 2. Create a derived cell (updates automatically)
const greeting = Cell.derived(() => `Hello, ${name.get()}!`);

// 3. Listen for changes
greeting.listen((msg) => console.log(msg));

// 4. Update the source
name.set('Cells'); // Console: "Hello, Cells!"
```

---

## Guide

### 1. Core Concepts

#### Source Cells

The root of your state graph. You can read, subscribe to, and modify them.

```javascript
const count = Cell.source(0);

count.set(1);
console.log(count.get()); // 1
```

#### Derived Cells

Computed values that update automatically when dependencies change. They are eager and always kept in sync.

```javascript
const count = Cell.source(1);
const double = Cell.derived(() => count.get() * 2);

console.log(double.get()); // 2

count.set(5);
console.log(double.get()); // 10
```

#### Effects (`listen`)

Run side effects when a cell changes.

```javascript
const count = Cell.source(0);

// Runs only on updates
const unsubscribe = count.listen((val) => console.log(val));

// Runs immediately, then on updates
count.runAndListen((val) => console.log('Current:', val));

// Cleanup when done
unsubscribe();
```

---

### 2. Asynchronous State

Cells shines when handling async operations, replacing manual promise handling with declarative primitives.

#### Async Derived Cells

Use `Cell.derivedAsync` for data fetching or heavy computations. It automatically exposes `pending` and `error` states.

```javascript
const userId = Cell.source(1);

const user = Cell.derivedAsync(async (get, signal) => {
  // 'get' tracks dependencies
  const id = get(userId);

  // 'signal' handles cancellation automatically if userId changes
  const res = await fetch(`/api/users/${id}`, { signal });
  return res.json();
});

// Built-in status tracking
user.pending.listen((isLoading) => console.log(isLoading ? 'Loading...' : 'Done'));
user.error.listen((err) => err && console.error(err));

// Access the data
const data = await user.get();
```

#### Task Cells

Use `Cell.task` for user-triggered actions (e.g., form submissions). Unlike derived cells, these only execute when triggered with `runWith`.

```javascript
const login = Cell.task(async (creds, signal) => {
  const res = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(creds),
    signal,
  });
  return res.json();
});

// Trigger the task
const result = await login.runWith({ user: 'admin', pass: '1234' });

// Track status
login.pending.listen((isPending) => {
  submitButton.disabled = isPending;
});
```

#### Composite Cells

Group multiple async cells into a synchronized unit. Useful for preventing partial updates or ensuring "all-or-nothing" behavior.

```javascript
const profile = Cell.derivedAsync(fetchProfile);
const posts = Cell.derivedAsync(fetchPosts);

// Waits for BOTH to finish before updating
const dashboard = Cell.composite({ profile, posts });

dashboard.pending.listen((isPending) => showSpinner(isPending));
dashboard.error.listen((err) => err && showError(err));

dashboard.loaded.listen(async (ready) => {
  if (ready) {
    const profileData = await dashboard.values.profile.get();
    const postsData = await dashboard.values.posts.get();
    renderDashboard(profileData, postsData);
  }
});
```

---

### 3. Advanced Patterns

#### Batch Updates

Group multiple updates into a single notification to avoid unnecessary re-computations.

```javascript
Cell.batch(() => {
  firstName.set('John');
  lastName.set('Doe');
  // Effects run once here, after the block finishes
});
```

#### Peeking

Read a value *without* subscribing to it.

```javascript
const sum = Cell.derived(() => {
  // Re-runs if 'a' changes, but NOT if 'b' changes
  return a.get() + b.peek();
});
```

#### Custom Equality

Customize how cells detect changes.

```javascript
const user = Cell.source(
  { id: 1, name: 'Alice' },
  {
    equals: (a, b) => a.id === b.id, // Only update if ID changes
  }
);
```

#### Memory Management (Contexts)

For high-performance scenarios involving many dynamically created cells, use `LocalContext` for manual disposal.

```javascript
const ctx = Cell.context();

Cell.runWithContext(ctx, () => {
  // All listeners and derived cells created here are bound to 'ctx'
  source.listen(handler);
  const derived = Cell.derived(() => source.get() * 2);
});

// Clean up everything at once
ctx.destroy();
```

---

## API Reference

### `Cell` Static Methods

| Method | Description |
|--------|-------------|
| `source(value, options?)` | Creates a mutable source cell. |
| `derived(fn)` | Creates a computed cell from other cells. |
| `derivedAsync(fn)` | Creates an async computed cell with cancellation support. |
| `task(fn)` | Creates a triggerable async task. |
| `composite(map)` | Combines multiple cells into a synchronized object. |
| `batch(fn)` | Batches updates to prevent multiple effect triggers. |
| `context()` | Creates a new `LocalContext` for scoped memory management. |
| `runWithContext(ctx, fn)` | Executes a function within a specific `LocalContext`. |
| `isCell(value)` | Returns `true` if the value is a Cell. |

### Cell Instance Methods

| Method | Description |
|--------|-------------|
| `get()` | Returns the value. Registers dependency if in a derivation. |
| `peek()` | Returns the value without registering a dependency. |
| `listen(callback, options?)` | Subscribes to changes. Returns an unsubscribe function. |
| `runAndListen(callback, options?)` | Runs callback immediately, then subscribes to future changes. |
| `ignore(callback)` | Removes a previously registered listener. |
| `valueOf()` | Returns the raw value (for implicit coercion). |
| `toString()` | Returns the stringified value. |

### `SourceCell` Methods

| Method | Description |
|--------|-------------|
| `set(value)` | Updates the cell's value and notifies listeners. |

### `AsyncCell` Properties and Methods

Available on `AsyncDerivedCell` and `AsyncTaskCell`:

| Property/Method | Description |
|-----------------|-------------|
| `pending` | A `Cell<boolean>` indicating loading state. |
| `error` | A `Cell<Error \| null>` holding the last error. |
| `get()` | Returns a `Promise` that resolves to the value. |
| `peek()` | Returns a `Promise` without registering dependencies. |

### `AsyncDerivedCell` Methods

| Method | Description |
|--------|-------------|
| `revalidate()` | Forces a refresh of the async computation. |

### `AsyncTaskCell` Methods

| Method | Description |
|--------|-------------|
| `runWith(input)` | Executes the task with the given input. Returns a `Promise`. |

### `Composite` Object

Returned by `Cell.composite()`:

| Property | Description |
|----------|-------------|
| `values` | Object containing synchronized async cells for each input key. |
| `pending` | A `Cell<boolean>` that is `true` while any input is pending. |
| `error` | A `Cell<Error \| null>` with the first error from any input. |
| `loaded` | A `Cell<boolean>` that becomes `true` after initial load completes. |

### `LocalContext` Methods

| Method | Description |
|--------|-------------|
| `destroy()` | Disposes all listeners and derived cells bound to this context. |

### Effect Options

Options for `listen()` and `runAndListen()`:

| Option | Type | Description |
|--------|------|-------------|
| `once` | `boolean` | Remove the listener after it fires once. |
| `signal` | `AbortSignal` | Automatically remove listener when signal aborts. |
| `weak` | `boolean` | Use a weak reference (listener may be garbage collected). |
| `priority` | `number` | Execution order (higher runs first, default: 0). |

### Cell Options

Options for `Cell.source()`:

| Option | Type | Description |
|--------|------|-------------|
| `equals` | `(a, b) => boolean` | Custom equality function for change detection. |

---

## TypeScript Support

Cells is written in JavaScript with comprehensive JSDoc annotations and ships with TypeScript declaration files.

```typescript
import { Cell, SourceCell, DerivedCell, AsyncDerivedCell } from '@adbl/cells';

// Types are inferred automatically
const count: SourceCell<number> = Cell.source(0);
const doubled: DerivedCell<number> = Cell.derived(() => count.get() * 2);

// Async cells with proper typing
const user: AsyncDerivedCell<User> = Cell.derivedAsync(async (get) => {
  const id = get(userId);
  const res = await fetch(`/api/users/${id}`);
  return res.json() as User;
});

// Task cells with input/output types
const submitForm = Cell.task(async (data: FormData, signal: AbortSignal) => {
  const res = await fetch('/api/submit', { method: 'POST', body: data, signal });
  return res.json() as SubmitResult;
});
```

---

## Contributing

Contributions are welcome! Here's how to get started:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/adebola-io/signals.git
cd signals

# Install dependencies
npm install

# Run tests in watch mode
npm test

# Run tests once
npm run test-once

# Build the project
npm run build
```

### Running Tests

```bash
npm test
```

The test suite uses [Vitest](https://vitest.dev/) and covers all core functionality including async behavior and race conditions.

---

## License

MIT © [Sefunmi Adebola Akomolafe](https://github.com/adebola-io)
