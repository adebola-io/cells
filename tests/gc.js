import('../library/index.js').then((module) => {
  const Cell = module.Cell;

  function createDerived() {
    const cell = Cell.source(1);
    Cell.derived(() => cell.get() + 1);
    return cell;
  }

  global.gc?.();
  const cell = createDerived();

  setTimeout(() => {
    global.gc?.();
    console.log(cell.derivedCells);
  }, 1000);
  console.log(cell.derivedCells);
});
