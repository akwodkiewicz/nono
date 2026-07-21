import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Solver, restoreSolver, type SolverStatus, type StepResult } from '../solver/solver';
import { EMPTY, FILLED, type Grid, type LineRef, type Puzzle, type SolveStep } from '../solver/types';
import { validatePuzzle } from '../solver/validate';
import { parseClueText } from './clueText';

export type View = 'library' | 'editor' | 'import' | 'solver';
export type UiStatus = 'ready' | SolverStatus;

/** Wynik sprawdzenia pola: stan komórki w ukrytym pełnym rozwiązaniu. */
export type CheckCellState = 'filled' | 'empty' | 'unknown' | 'invalid';

export interface CheckResult {
  row: number;
  col: number;
  state: CheckCellState;
}

export const MAX_SIZE = 60;
/** Domyślny rozmiar planszy dla nowej, pustej zagadki. */
const DEFAULT_SIZE = 10;

/**
 * Jedna zagadka w bibliotece: jej wskazówki (robocze teksty) oraz stan
 * rozwiązywania. To dokładnie te pola, które solver/edytor trzymają dla
 * „aktywnej" zagadki — biblioteka pamięta je per zagadka, żeby przełączanie
 * między zagadkami nie gubiło postępu ani odczytu OCR.
 */
export interface PuzzleEntry {
  id: string;
  rowTexts: string[];
  colTexts: string[];
  /** Zagadka aktualnie w solverze (ustawiana przy starcie rozwiązywania). */
  puzzle?: Puzzle;
  grid: Grid;
  steps: SolveStep[];
  status: UiStatus;
  contradiction?: LineRef;
  createdAt: number;
  /** Data dodania lub ostatniej edycji definicji (wskazówek); kroki solvera
   *  jej nie ruszają. */
  updatedAt: number;
}

interface AppState {
  view: View;
  /** Biblioteka wszystkich zagadek. */
  puzzles: PuzzleEntry[];
  /** Id zagadki aktualnie w edytorze/solverze; null = brak (widok biblioteki). */
  activeId: string | null;

  // Pola robocze aktywnej zagadki. Lustro utrzymywane w subscribe niżej
  // zapisuje je z powrotem do puzzles[activeId], więc solver/edytor działają
  // na nich bez zmian, a biblioteka i tak dostaje aktualny stan.
  rowTexts: string[];
  colTexts: string[];
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
  goHome: () => void;
  newPuzzle: () => void;
  openPuzzle: (id: string) => void;
  deletePuzzle: (id: string) => void;

  setRowText: (index: number, text: string) => void;
  setColText: (index: number, text: string) => void;
  /** Podmienia całe listy wskazówek (wynik OCR / import); zmienia też wymiary. */
  setRowTexts: (texts: string[]) => void;
  setColTexts: (texts: string[]) => void;
  setRowCount: (count: number) => void;
  setColCount: (count: number) => void;
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

function blankTexts(count: number): string[] {
  return Array<string>(count).fill('');
}

function newEntry(rowTexts: string[], colTexts: string[]): PuzzleEntry {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    rowTexts,
    colTexts,
    puzzle: undefined,
    grid: [],
    steps: [],
    status: 'ready',
    contradiction: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/** Pola wspólne wpisu biblioteki i pól roboczych store'u. */
type PuzzleFields = Pick<
  PuzzleEntry,
  'rowTexts' | 'colTexts' | 'puzzle' | 'grid' | 'steps' | 'status' | 'contradiction'
>;

/** Wyciąga pola robocze z wpisu biblioteki lub ze stanu store'u. */
function activeFields(src: PuzzleFields): PuzzleFields {
  return {
    rowTexts: src.rowTexts,
    colTexts: src.colTexts,
    puzzle: src.puzzle,
    grid: src.grid,
    steps: src.steps,
    status: src.status,
    contradiction: src.contradiction,
  };
}

// Instancja solvera żyje poza store'em: zawiera kolejkę i mutowalną planszę,
// a do store'u trafiają jej niemutowalne migawki (React dostaje nowe referencje).
// Dotyczy zawsze aktywnej zagadki — przy przełączeniu resetujemy ją do null.
let solver: Solver | null = null;

// Ukryte pełne rozwiązanie do sprawdzania pojedynczych pól — liczone leniwie
// osobną instancją solvera, żeby nie ruszać postępu widocznego na planszy.
let solutionCache: { grid: Grid; status: SolverStatus } | null = null;

// Persystujemy tylko bibliotekę, aktywną zagadkę i widok; pola robocze są
// pochodne (wczytywane z aktywnego wpisu w merge). Ekran importu ma stan
// lokalny w komponencie, więc po reloadzie wracamy z niego do edytora.
type PersistedState = {
  puzzles: PuzzleEntry[];
  activeId: string | null;
  view: View;
};

const partializeState = (s: AppState): PersistedState => ({
  puzzles: s.puzzles,
  activeId: s.activeId,
  view: s.view === 'import' ? 'editor' : s.view,
});

/**
 * Wersja 1 zapisywała pojedynczą zagadkę zestawem płaskich pól. Migracja do v2
 * pakuje ją w jednoelementową bibliotekę.
 */
export function migrateV1toV2(old: Record<string, unknown>): PersistedState {
  const entry: PuzzleEntry = {
    id: crypto.randomUUID(),
    rowTexts: (old.rowTexts as string[]) ?? blankTexts(DEFAULT_SIZE),
    colTexts: (old.colTexts as string[]) ?? blankTexts(DEFAULT_SIZE),
    puzzle: old.puzzle as Puzzle | undefined,
    grid: (old.grid as Grid) ?? [],
    steps: (old.steps as SolveStep[]) ?? [],
    status: (old.status as UiStatus) ?? 'ready',
    contradiction: old.contradiction as LineRef | undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const oldView = old.view as View | undefined;
  return {
    puzzles: [entry],
    activeId: entry.id,
    view: oldView === 'solver' ? 'solver' : oldView === 'editor' ? 'editor' : 'library',
  };
}

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
      view: 'library',
      puzzles: [],
      activeId: null,
      rowTexts: [''],
      colTexts: [''],
      puzzle: undefined,
      grid: [],
      steps: [],
      status: 'ready',
      contradiction: undefined,
      viewStep: null,
      checkMode: false,
      checkResult: null,

      setView: (view) => set({ view }),
      goHome: () => set({ view: 'library' }),

      newPuzzle: () => {
        const entry = newEntry(blankTexts(DEFAULT_SIZE), blankTexts(DEFAULT_SIZE));
        solver = null;
        solutionCache = null;
        set((s) => ({
          puzzles: [...s.puzzles, entry],
          activeId: entry.id,
          view: 'editor',
          viewStep: null,
          checkMode: false,
          checkResult: null,
          ...activeFields(entry),
        }));
      },
      openPuzzle: (id) => {
        const entry = get().puzzles.find((p) => p.id === id);
        if (!entry) return;
        solver = null;
        solutionCache = null;
        set({
          activeId: id,
          view: entry.steps.length > 0 ? 'solver' : 'editor',
          viewStep: null,
          checkMode: false,
          checkResult: null,
          ...activeFields(entry),
        });
      },
      deletePuzzle: (id) => {
        const s = get();
        const puzzles = s.puzzles.filter((p) => p.id !== id);
        if (s.activeId !== id) {
          set({ puzzles });
          return;
        }
        solver = null;
        solutionCache = null;
        set({
          puzzles,
          activeId: null,
          view: 'library',
          viewStep: null,
          checkMode: false,
          checkResult: null,
          rowTexts: [''],
          colTexts: [''],
          puzzle: undefined,
          grid: [],
          steps: [],
          status: 'ready',
          contradiction: undefined,
        });
      },

      setRowText: (index, text) =>
        set((s) => ({ rowTexts: s.rowTexts.map((t, i) => (i === index ? text : t)) })),
      setColText: (index, text) =>
        set((s) => ({ colTexts: s.colTexts.map((t, i) => (i === index ? text : t)) })),
      setRowTexts: (texts) => set({ rowTexts: texts.length > 0 ? texts : [''] }),
      setColTexts: (texts) => set({ colTexts: texts.length > 0 ? texts : [''] }),
      setRowCount: (count) => set((s) => ({ rowTexts: resize(s.rowTexts, count) })),
      setColCount: (count) => set((s) => ({ colTexts: resize(s.colTexts, count) })),
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
      version: 2,
      partialize: partializeState,
      migrate: (persisted, version) => {
        if (version < 2) return migrateV1toV2(persisted as Record<string, unknown>);
        return persisted as PersistedState;
      },
      // Persystujemy tylko bibliotekę — pola robocze odtwarzamy z aktywnego
      // wpisu, żeby edytor/solver od razu widziały właściwą zagadkę.
      merge: (persisted, current) => {
        const p = persisted as Partial<PersistedState> | undefined;
        const merged: AppState = {
          ...current,
          ...(p ?? {}),
        } as AppState;
        const entry = merged.puzzles.find((e) => e.id === merged.activeId);
        if (entry) {
          Object.assign(merged, activeFields(entry));
        } else {
          merged.activeId = null;
          merged.view = 'library';
        }
        return merged;
      },
    },
  ),
);

// Lustro pól roboczych → aktywny wpis biblioteki. Jedno miejsce synchronizacji:
// istniejące akcje edytora/solvera zmieniają tylko pola robocze, a tu trafiają
// z powrotem do puzzles[activeId]. Porównanie po referencji wystarcza — akcje
// tworzą nowe referencje tylko przy realnej zmianie, więc przełączenie zagadki
// (te same referencje) nic nie zapisuje. `updatedAt` bijemy tylko przy zmianie
// samej definicji (wskazówek) — kroki solvera zapisujemy, ale daty nie ruszają,
// bo etykieta w galerii pokazuje datę dodania/edycji zagadki, nie ostatni ruch.
let mirroring = false;
useAppStore.subscribe((state) => {
  if (mirroring || !state.activeId) return;
  const idx = state.puzzles.findIndex((p) => p.id === state.activeId);
  if (idx === -1) return;
  const entry = state.puzzles[idx];
  if (
    entry.rowTexts === state.rowTexts &&
    entry.colTexts === state.colTexts &&
    entry.puzzle === state.puzzle &&
    entry.grid === state.grid &&
    entry.steps === state.steps &&
    entry.status === state.status &&
    entry.contradiction === state.contradiction
  ) {
    return;
  }
  const definitionChanged =
    entry.rowTexts !== state.rowTexts || entry.colTexts !== state.colTexts;
  const updated: PuzzleEntry = {
    ...entry,
    ...activeFields(state),
    updatedAt: definitionChanged ? Date.now() : entry.updatedAt,
  };
  mirroring = true;
  useAppStore.setState({
    puzzles: state.puzzles.map((p, i) => (i === idx ? updated : p)),
  });
  mirroring = false;
});
