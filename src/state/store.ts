import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cluesFromGrid, gridFromStrings } from '../solver/clues';
import { Solver, restoreSolver, type SolverStatus, type StepResult } from '../solver/solver';
import { EMPTY, FILLED, type Grid, type LineRef, type Puzzle, type SolveStep } from '../solver/types';
import { validatePuzzle } from '../solver/validate';
import { formatClue, parseClueText } from './clueText';

export type View = 'editor' | 'import' | 'solver';
export type UiStatus = 'ready' | SolverStatus;

/** Wynik sprawdzenia pola: stan komórki w ukrytym pełnym rozwiązaniu. */
export type CheckCellState = 'filled' | 'empty' | 'unknown' | 'invalid';

export interface CheckResult {
  row: number;
  col: number;
  state: CheckCellState;
}

export const MAX_SIZE = 60;

const EXAMPLE = cluesFromGrid(
  gridFromStrings([
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
  ]),
);

interface AppState {
  view: View;
  rowTexts: string[];
  colTexts: string[];
  /** Zagadka aktualnie w solverze (ustawiana przy starcie rozwiązywania). */
  puzzle?: Puzzle;
  grid: Grid;
  steps: SolveStep[];
  status: UiStatus;
  contradiction?: LineRef;
  /** Indeks kroku oglądanego w historii; null = stan bieżący. */
  viewStep: number | null;
  /** Tryb sprawdzania: tap w komórkę zdradza jej stan w pełnym rozwiązaniu. */
  checkMode: boolean;
  checkResult: CheckResult | null;

  setView: (view: View) => void;
  setRowText: (index: number, text: string) => void;
  setColText: (index: number, text: string) => void;
  /** Podmienia całe listy wskazówek (wynik OCR / import); zmienia też wymiary. */
  setRowTexts: (texts: string[]) => void;
  setColTexts: (texts: string[]) => void;
  setRowCount: (count: number) => void;
  setColCount: (count: number) => void;
  loadExample: () => void;
  clearClues: () => void;
  startSolver: () => void;
  stepOnce: () => void;
  undoStep: () => void;
  setViewStep: (index: number | null) => void;
  toggleCheckMode: () => void;
  checkCell: (row: number, col: number) => void;
}

/** Parsuje teksty wskazówek; null, gdy którakolwiek linia jest niepoprawna. */
export function parsePuzzle(rowTexts: string[], colTexts: string[]): Puzzle | null {
  const rowClues: number[][] = [];
  for (const text of rowTexts) {
    const clue = parseClueText(text);
    if (clue === null) return null;
    rowClues.push(clue);
  }
  const colClues: number[][] = [];
  for (const text of colTexts) {
    const clue = parseClueText(text);
    if (clue === null) return null;
    colClues.push(clue);
  }
  return { rowClues, colClues };
}

// Instancja solvera żyje poza store'em: zawiera kolejkę i mutowalną planszę,
// a do store'u trafiają jej niemutowalne migawki (React dostaje nowe referencje).
let solver: Solver | null = null;

// Ukryte pełne rozwiązanie do sprawdzania pojedynczych pól — liczone leniwie
// osobną instancją solvera, żeby nie ruszać postępu widocznego na planszy.
let solutionCache: { grid: Grid; status: SolverStatus } | null = null;

// Postęp solvera przeżywa odświeżenie strony i aktualizację wersji aplikacji.
// Instancja solvera nie jest serializowalna — odbudowuje ją ensureSolver
// z zagadki i kroków. Ekran importu ma stan lokalny w komponencie, więc po
// reloadzie wracamy z niego do edytora.
const partializeState = (s: AppState) => ({
  rowTexts: s.rowTexts,
  colTexts: s.colTexts,
  view: (s.view === 'import' ? 'editor' : s.view) as View,
  puzzle: s.puzzle,
  grid: s.grid,
  steps: s.steps,
  status: s.status,
  contradiction: s.contradiction,
});

/**
 * Instancja solvera nie jest persystowana — po przeładowaniu strony
 * odbudowujemy ją przy pierwszym użyciu z zapisanej zagadki i kroków.
 */
function ensureSolver(state: AppState): Solver | null {
  if (!solver && state.puzzle) {
    solver = restoreSolver(state.puzzle, state.steps);
  }
  return solver;
}

function snapshot(result?: StepResult) {
  if (!solver) {
    return {
      grid: [] as Grid,
      steps: [] as SolveStep[],
      status: 'ready' as UiStatus,
      contradiction: undefined,
    };
  }
  return {
    grid: solver.grid.map((row) => [...row]),
    steps: [...solver.steps],
    status: (result?.status ?? 'ready') as UiStatus,
    contradiction: result?.contradiction,
  };
}

function resize(texts: string[], count: number): string[] {
  const n = Math.max(1, Math.min(MAX_SIZE, Math.floor(count) || 1));
  return texts.length >= n
    ? texts.slice(0, n)
    : [...texts, ...Array<string>(n - texts.length).fill('')];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'editor',
      rowTexts: EXAMPLE.rowClues.map(formatClue),
      colTexts: EXAMPLE.colClues.map(formatClue),
      puzzle: undefined,
      grid: [],
      steps: [],
      status: 'ready',
      contradiction: undefined,
      viewStep: null,
      checkMode: false,
      checkResult: null,

      setView: (view) => set({ view }),
      setRowText: (index, text) =>
        set((s) => ({ rowTexts: s.rowTexts.map((t, i) => (i === index ? text : t)) })),
      setColText: (index, text) =>
        set((s) => ({ colTexts: s.colTexts.map((t, i) => (i === index ? text : t)) })),
      setRowTexts: (texts) => set({ rowTexts: texts.length > 0 ? texts : [''] }),
      setColTexts: (texts) => set({ colTexts: texts.length > 0 ? texts : [''] }),
      setRowCount: (count) => set((s) => ({ rowTexts: resize(s.rowTexts, count) })),
      setColCount: (count) => set((s) => ({ colTexts: resize(s.colTexts, count) })),
      loadExample: () =>
        set({
          rowTexts: EXAMPLE.rowClues.map(formatClue),
          colTexts: EXAMPLE.colClues.map(formatClue),
        }),
      clearClues: () =>
        set((s) => ({
          rowTexts: s.rowTexts.map(() => ''),
          colTexts: s.colTexts.map(() => ''),
        })),

      startSolver: () => {
        const { rowTexts, colTexts } = get();
        const puzzle = parsePuzzle(rowTexts, colTexts);
        if (!puzzle || validatePuzzle(puzzle).length > 0) return;
        solver = new Solver(puzzle);
        solutionCache = null;
        set({
          view: 'solver',
          puzzle,
          viewStep: null,
          checkMode: false,
          checkResult: null,
          ...snapshot(),
        });
      },
      stepOnce: () => {
        const s = ensureSolver(get());
        if (!s) return;
        set({ viewStep: null, ...snapshot(s.step()) });
      },
      undoStep: () => {
        const s = ensureSolver(get());
        if (!s || !s.undo()) return;
        set({
          viewStep: null,
          ...snapshot(),
          status: s.steps.length > 0 ? 'progress' : 'ready',
        });
      },
      setViewStep: (index) =>
        set((s) => ({
          viewStep: index === null || index >= s.steps.length - 1 ? null : Math.max(0, index),
        })),
      toggleCheckMode: () => set((s) => ({ checkMode: !s.checkMode, checkResult: null })),
      checkCell: (row, col) => {
        const { puzzle } = get();
        if (!puzzle) return;
        if (!solutionCache) {
          const full = new Solver(puzzle);
          const result = full.run();
          solutionCache = { grid: full.grid.map((r) => [...r]), status: result.status };
        }
        const value = solutionCache.grid[row]?.[col];
        const state: CheckCellState =
          solutionCache.status === 'contradiction'
            ? 'invalid'
            : value === FILLED
              ? 'filled'
              : value === EMPTY
                ? 'empty'
                : 'unknown';
        set({ checkResult: { row, col, state } });
      },
    }),
    {
      name: 'nono-clues',
      version: 1,
      partialize: partializeState,
      // Wersja 0 zapisywała podzbiór pól (same teksty wskazówek) — merge
      // uzupełnia brakujące wartościami domyślnymi.
      migrate: (persisted) => persisted as ReturnType<typeof partializeState>,
    },
  ),
);
