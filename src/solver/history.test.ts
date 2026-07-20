import { describe, expect, it } from 'vitest';
import { cluesFromGrid, gridFromStrings } from './clues';
import { gridAfterSteps } from './history';
import { Solver } from './solver';
import { UNKNOWN } from './types';

describe('gridAfterSteps', () => {
  it('odtwarza stany pośrednie i końcowy', () => {
    const solver = new Solver(cluesFromGrid(gridFromStrings(['..#..', '..#..', '#####', '..#..', '..#..'])));
    const result = solver.run();
    expect(result.status).toBe('solved');

    // -1 → plansza pusta
    const empty = gridAfterSteps(5, 5, solver.steps, -1);
    expect(empty.flat().every((c) => c === UNKNOWN)).toBe(true);

    // po pierwszym kroku — dokładnie tyle komórek, ile wniosków w kroku 0
    const first = gridAfterSteps(5, 5, solver.steps, 0);
    expect(first.flat().filter((c) => c !== UNKNOWN)).toHaveLength(
      solver.steps[0].deductions.length,
    );

    // po wszystkich krokach — identyczna z planszą solvera
    const full = gridAfterSteps(5, 5, solver.steps, solver.steps.length - 1);
    expect(full).toEqual(solver.grid);
  });
});
