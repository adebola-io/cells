# bullet

bullet is a lightweight library that provides an implementation of signals in JavaScript. Signals are a reactive programming concept that allows you to define data flows and propagate changes through your application in a declarative manner.

## Features

- **Simple API**: bullet has a straightforward API for creating and working with signals.
- **Reactive Updates**: When a signal's value changes, all computations and side effects that depend on that signal are automatically updated.
- **Composable**: Signals can be combined and transformed using built-in operators, enabling complex data flows.
- **Lightweight**: bullet has a small footprint and no external dependencies, making it easy to integrate into your projects.

## Installation

You can install bullet via npm:

npm install @adbl/bullet

## Usage

Here's a basic example of how to use bullet:

```javascript
import { Signal } from '@adbl/bullet';

// Create a signal
const count = Signal.cell(0);

// Derive a new signal based on the count signal
const doubledCount = Signal.derived(() => count.value * 2);

// Subscribe to changes in the derived signal
doubledCount.subscribe((value) => {
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
