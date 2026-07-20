import { emptyGrid, type Grid, type SolveStep } from './types';

/**
 * Rekonstruuje stan planszy po wykonaniu kroków 0..upto (włącznie).
 * Kroki są diffami (każda komórka dedukowana dokładnie raz), więc podgląd
 * dowolnego punktu historii to tanie ponowne nałożenie wniosków — solver
 * nie musi umieć się cofać do dowolnego miejsca.
 */
export function gridAfterSteps(
  height: number,
  width: number,
  steps: readonly SolveStep[],
  upto: number,
): Grid {
  const grid = emptyGrid(height, width);
  const last = Math.min(upto, steps.length - 1);
  for (let i = 0; i <= last; i++) {
    for (const d of steps[i].deductions) {
      grid[d.row][d.col] = d.value;
    }
  }
  return grid;
}
