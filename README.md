# bullet

bullet is a(nother) library that provides an implementation of signals in JavaScript, as objects called Cells. They allows the definition of data flows and propagate changes in a declarative manner.

## Features

- **Simple API**: bullet has a straightforward API for creating and working with signals.
- **Reactive Updates**: When a cell's value changes, all computations and side effects that depend on that signal are automatically updated.
- **Composable**: Cells can be combined and transformed using built-in operators, enabling complex data flows.
- **Lightweight**: bullet has a small footprint and no external dependencies, making it easy to integrate into your projects.

## Installation

You can install bullet via npm:

```shell
npm install @adbl/bullet
```

## Usage

Here's a basic example of how to use bullet:

```javascript
import { Cell } from '@adbl/bullet';

// Create a reactive cell
const count = Cell.source(0);

// Derive a new cell based on the count cell
const doubledCount = Cell.derived(() => count.value * 2);

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

bullet is released under the MIT License.
