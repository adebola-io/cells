# signals

signals is a(nother) library that provides an implementation of signals in JavaScript. They allow the definition of data flows and propagate changes in a declarative manner.

## Features

- **Simple API**: signals has a straightforward API for creating and working with signals.
- **Reactive Updates**: When a signal's value changes, all computations and side effects that depend on that signal are automatically updated.
- **Composable**: Signals can be combined and transformed using built-in operators, enabling complex data flows.
- **Lightweight**: signals has a small footprint and no external dependencies, making it easy to integrate into your projects.

## Installation

You can install signals via npm:

```shell
npm install @adbl/signals
```

## Usage

Here's a basic example of how to use signals:

```js
import { Signal } from '@adbl/signals';

// Create a reactive signal
const count = Signal.source(0);

// Derive a new signal based on the count signal
const doubledCount = Signal.derived(() => count.value * 2);

// Subscribe to changes in the derived signal
doubledCount.createEffect((value) => {
  console.log(`Doubled count: ${value}`);
});

// Update the original signal
count.value = 1; // Logs: "Doubled count: 2"
count.value = 3; // Logs: "Doubled count: 6"
```

# Contributing

Contributions are welcome!

# License

signals is released under the MIT License.
