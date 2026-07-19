/** Stan pojedynczej komórki planszy. */
export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;

export type Cell = typeof UNKNOWN | typeof FILLED | typeof EMPTY;

/**
 * Definicja zagadki: wskazówki wierszy (od góry do dołu) i kolumn (od lewej
 * do prawej). Każda wskazówka to lista długości bloków; pusta lista (lub [0])
 * oznacza linię bez wypełnionych komórek.
 */
export interface Puzzle {
  rowClues: number[][];
  colClues: number[][];
}

export type Grid = Cell[][]; // [wiersz][kolumna]

export interface LineRef {
  kind: 'row' | 'col';
  index: number;
}

/** Pojedynczy wniosek: komórka o pewnej, wydedukowanej wartości. */
export interface Deduction {
  row: number;
  col: number;
  value: Cell;
}

/** Jeden krok solvera: analiza jednej linii, która dała nowe wnioski. */
export interface SolveStep {
  line: LineRef;
  clue: number[];
  deductions: Deduction[];
}

export function puzzleWidth(puzzle: Puzzle): number {
  return puzzle.colClues.length;
}

export function puzzleHeight(puzzle: Puzzle): number {
  return puzzle.rowClues.length;
}

export function emptyGrid(height: number, width: number): Grid {
  return Array.from({ length: height }, () => Array<Cell>(width).fill(UNKNOWN));
}
