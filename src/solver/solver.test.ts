import { describe, expect, it } from 'vitest';
import { cluesFromGrid, gridFromStrings } from './clues';
import { Solver, restoreSolver } from './solver';
import { EMPTY, FILLED, UNKNOWN, type Grid } from './types';

function gridToStrings(grid: Grid): string[] {
  return grid.map((row) =>
    row.map((c) => (c === FILLED ? '#' : c === EMPTY ? '.' : '?')).join(''),
  );
}

function solveArt(art: string[]) {
  const solution = gridFromStrings(art);
  const solver = new Solver(cluesFromGrid(solution));
  const result = solver.run();
  return { solver, result };
}

describe('Solver', () => {
  it('rozwiązuje krzyż 5x5', () => {
    const art = ['..#..', '..#..', '#####', '..#..', '..#..'];
    const { solver, result } = solveArt(art);
    expect(result.status).toBe('solved');
    expect(gridToStrings(solver.grid)).toEqual(art);
  });

  it('rozwiązuje serce 8x9', () => {
    const art = [
      '.##...##.',
      '#########',
      '#########',
      '#########',
      '.#######.',
      '..#####..',
      '...###...',
      '....#....',
    ];
    const { solver, result } = solveArt(art);
    expect(result.status).toBe('solved');
    expect(gridToStrings(solver.grid)).toEqual(art);
  });

  it('rozwiązuje zagadkę 10x10', () => {
    const art = [
      '....##....',
      '...####...',
      '..######..',
      '.########.',
      '##########',
      '####..####',
      '###....###',
      '###....###',
      '####..####',
      '##########',
    ];
    const { solver, result } = solveArt(art);
    expect(result.status).toBe('solved');
    expect(gridToStrings(solver.grid)).toEqual(art);
  });

  it('każda komórka jest dedukowana dokładnie raz', () => {
    const { solver, result } = solveArt(['..#..', '..#..', '#####', '..#..', '..#..']);
    expect(result.status).toBe('solved');
    const total = solver.steps.reduce((sum, s) => sum + s.deductions.length, 0);
    expect(total).toBe(5 * 5);
    for (const step of solver.steps) {
      expect(step.deductions.length).toBeGreaterThan(0);
    }
  });

  it('zagadka wymagająca zgadywania → stuck, plansza nietknięta', () => {
    // Dwa rozwiązania (szachownica 2x2) — logika liniowa nie ma tu żadnego
    // pewnego wniosku, więc solver nie może oznaczyć ani jednej komórki.
    const solver = new Solver({ rowClues: [[1], [1]], colClues: [[1], [1]] });
    const result = solver.run();
    expect(result.status).toBe('stuck');
    expect(solver.steps).toHaveLength(0);
    expect(solver.grid.flat().every((c) => c === UNKNOWN)).toBe(true);
  });

  it('sprzeczne dane → contradiction ze wskazaniem linii', () => {
    // Wiersze wymuszają pełną planszę 2x2, kolumny pozwalają tylko na 1 komórkę.
    const solver = new Solver({ rowClues: [[2], [2]], colClues: [[1], [1]] });
    const result = solver.run();
    expect(result.status).toBe('contradiction');
    expect(result.contradiction).toBeDefined();
    expect(result.contradiction?.kind).toBe('col');
  });

  it('krok po kroku dochodzi do tego samego rozwiązania co run()', () => {
    const art = ['.##...##.', '#########', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'];
    const solution = gridFromStrings(art);
    const solver = new Solver(cluesFromGrid(solution));
    let result = solver.step();
    let guard = 0;
    while (result.status === 'progress' && guard < 1000) {
      expect(result.step).toBeDefined();
      result = solver.step();
      guard++;
    }
    expect(result.status).toBe('solved');
    expect(gridToStrings(solver.grid)).toEqual(art);
  });

  it('undo cofa ostatni krok i pozwala rozwiązać ponownie', () => {
    const art = ['..#..', '..#..', '#####', '..#..', '..#..'];
    const solver = new Solver(cluesFromGrid(gridFromStrings(art)));
    solver.step();
    solver.step();
    const unknownBefore = solver.unknownCount();
    const undone = solver.undo();
    expect(undone).toBeDefined();
    expect(solver.unknownCount()).toBe(unknownBefore + (undone?.deductions.length ?? 0));
    expect(solver.steps).toHaveLength(1);
    const result = solver.run();
    expect(result.status).toBe('solved');
    expect(gridToStrings(solver.grid)).toEqual(art);
  });

  it('undo na świeżym solverze nic nie robi', () => {
    const solver = new Solver({ rowClues: [[1]], colClues: [[1]] });
    expect(solver.undo()).toBeUndefined();
  });

  it('restoreSolver odtwarza stan częściowy i pozwala dokończyć', () => {
    const art = ['..#..', '..#..', '#####', '..#..', '..#..'];
    const puzzle = cluesFromGrid(gridFromStrings(art));
    const original = new Solver(puzzle);
    original.step();
    original.step();

    const restored = restoreSolver(puzzle, [...original.steps]);
    expect(gridToStrings(restored.grid)).toEqual(gridToStrings(original.grid));
    expect(restored.steps).toHaveLength(2);
    // Undo działa też na odtworzonych krokach.
    expect(restored.undo()?.deductions.length).toBeGreaterThan(0);
    const result = restored.run();
    expect(result.status).toBe('solved');
    expect(gridToStrings(restored.grid)).toEqual(art);
  });

  it('restoreSolver stanu pełnego → step() zwraca solved', () => {
    const art = ['..#..', '..#..', '#####', '..#..', '..#..'];
    const puzzle = cluesFromGrid(gridFromStrings(art));
    const original = new Solver(puzzle);
    expect(original.run().status).toBe('solved');

    const restored = restoreSolver(puzzle, [...original.steps]);
    expect(restored.isSolved()).toBe(true);
    expect(restored.step().status).toBe('solved');
  });
});
