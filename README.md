# cells

cells is a(nother) library that provides an implementation of reactive updates in JavaScript. They allow the definition of data flows and propagate changes in a declarative manner.

## Features

- **Simple API**: cells has a straightforward API for creating and working with signals.
- **Reactive Updates**: When a cell's value changes, all computations and side effects that depend on that cell are automatically updated.
- **Composable**: Cells can be combined and transformed using built-in operators, enabling complex data flows.
- **Lightweight**: cells has a small footprint and no external dependencies, making it easy to integrate into your projects.

## Installation

You can install cells via npm:

```shell
npm install @adbl/cells
```

## Usage

Here's a basic example of how to use signals:

```js
import { Cell } from '@adbl/cells';

// Create a reactive cell
const count = Cell.source(0);

// Derive a new cell based on the count cell.
const doubledCount = Cell.derived(() => count.value * 2);

// Subscribe to changes in the derived cell.
doubledCount.listen((value) => {
  console.log(`Doubled count: ${value}`);
});

// Update the original cell.
count.value = 1; // Logs: "Doubled count: 2"
count.value = 3; // Logs: "Doubled count: 6"
```

## Contributing

Contributions are welcome!

## License

signals is released under the MIT License.
