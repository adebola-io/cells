import('../library/index.js').then((module) => {
  const Cell = module.Cell;

  function createDerived() {
    let cell = Cell.source(1);
    Cell.derived(() => cell.value + 1);
    return cell;
  }

  global.gc?.();
  let cell = createDerived();

  setTimeout(() => {
    global.gc?.();
    console.log(cell.derivedCells);
  }, 1000);
  console.log(cell.derivedCells);
});
