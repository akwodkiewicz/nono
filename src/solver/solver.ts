import { normalizeClue, solveLine } from './line';
import {
  UNKNOWN,
  emptyGrid,
  puzzleHeight,
  puzzleWidth,
  type Cell,
  type Deduction,
  type Grid,
  type LineRef,
  type Puzzle,
  type SolveStep,
} from './types';

export type SolverStatus = 'progress' | 'solved' | 'stuck' | 'contradiction';

export interface StepResult {
  status: SolverStatus;
  /** Wykonany krok — obecny przy 'progress' i 'solved'; przy 'contradiction' tylko wtedy, gdy sprzeczność wyszła w weryfikacji po ostatnim kroku. */
  step?: SolveStep;
  /** Linia, w której wykryto sprzeczność — obecna przy statusie 'contradiction'. */
  contradiction?: LineRef;
}

/**
 * Solver logiczny: iteruje analizę linii (solveLine) do punktu stałego,
 * propagując wnioski między wierszami a kolumnami. Każdy krok to analiza
 * jednej linii, która dała nowe, pewne wnioski — dokładnie tak, jak robiłby
 * to człowiek rozwiązujący zagadkę bez zgadywania.
 *
 * Kolejka "brudnych" linii: na start wszystkie wiersze i kolumny; po każdej
 * dedukcji do kolejki wracają linie prostopadłe do oznaczonych komórek.
 */
export class Solver {
  readonly puzzle: Puzzle;
  readonly width: number;
  readonly height: number;
  readonly grid: Grid;
  readonly steps: SolveStep[] = [];

  private queue: LineRef[] = [];
  private queued = new Set<string>();

  constructor(puzzle: Puzzle) {
    this.puzzle = puzzle;
    this.width = puzzleWidth(puzzle);
    this.height = puzzleHeight(puzzle);
    this.grid = emptyGrid(this.height, this.width);
    this.enqueueAll();
  }

  /** Jeden krok: analizuje linie z kolejki, aż któraś da nowe wnioski. */
  step(): StepResult {
    while (this.queue.length > 0) {
      const ref = this.queue.shift()!;
      this.queued.delete(lineKey(ref));

      const line = this.getLine(ref);
      const clue = this.getClue(ref);
      const solved = solveLine(line, clue);
      if (solved === null) {
        return { status: 'contradiction', contradiction: ref };
      }

      const deductions: Deduction[] = [];
      for (let i = 0; i < solved.length; i++) {
        if (line[i] === UNKNOWN && solved[i] !== UNKNOWN) {
          deductions.push({
            row: ref.kind === 'row' ? ref.index : i,
            col: ref.kind === 'row' ? i : ref.index,
            value: solved[i],
          });
        }
      }
      if (deductions.length === 0) continue;

      for (const d of deductions) {
        this.grid[d.row][d.col] = d.value;
        this.enqueue(
          ref.kind === 'row' ? { kind: 'col', index: d.col } : { kind: 'row', index: d.row },
        );
      }
      const step: SolveStep = { line: ref, clue: normalizeClue(clue), deductions };
      this.steps.push(step);

      if (this.isSolved()) {
        // Plansza pełna, ale w kolejce mogą czekać linie, których nikt nie
        // skonfrontował z ostatnimi wnioskami. Przy błędnych danych (np. po
        // pomyłce OCR) to właśnie tu wychodzi sprzeczność — bez tej weryfikacji
        // ogłosilibyśmy "rozwiązane" mimo złamanych wskazówek.
        const conflict = this.verifyRemaining();
        if (conflict) {
          return { status: 'contradiction', contradiction: conflict, step };
        }
        return { status: 'solved', step };
      }
      return { status: 'progress', step };
    }
    return { status: this.isSolved() ? 'solved' : 'stuck' };
  }

  /** Sprawdza pozostałe linie z kolejki; zwraca linię sprzeczną albo null. */
  private verifyRemaining(): LineRef | null {
    while (this.queue.length > 0) {
      const ref = this.queue.shift()!;
      this.queued.delete(lineKey(ref));
      if (solveLine(this.getLine(ref), this.getClue(ref)) === null) {
        return ref;
      }
    }
    return null;
  }

  /** Rozwiązuje do rozwiązania, utknięcia lub sprzeczności. */
  run(maxSteps = Number.POSITIVE_INFINITY): StepResult {
    let result = this.step();
    let count = 1;
    while (result.status === 'progress' && count < maxSteps) {
      result = this.step();
      count++;
    }
    return result;
  }

  /** Cofa ostatni krok. Wszystkie linie wracają do kolejki. */
  undo(): SolveStep | undefined {
    const step = this.steps.pop();
    if (!step) return undefined;
    for (const d of step.deductions) {
      this.grid[d.row][d.col] = UNKNOWN;
    }
    this.queue = [];
    this.queued.clear();
    this.enqueueAll();
    return step;
  }

  isSolved(): boolean {
    return this.grid.every((row) => row.every((cell) => cell !== UNKNOWN));
  }

  unknownCount(): number {
    let count = 0;
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell === UNKNOWN) count++;
      }
    }
    return count;
  }

  private enqueueAll() {
    for (let r = 0; r < this.height; r++) this.enqueue({ kind: 'row', index: r });
    for (let c = 0; c < this.width; c++) this.enqueue({ kind: 'col', index: c });
  }

  private enqueue(ref: LineRef) {
    const key = lineKey(ref);
    if (this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push(ref);
  }

  private getLine(ref: LineRef): Cell[] {
    return ref.kind === 'row'
      ? [...this.grid[ref.index]]
      : this.grid.map((row) => row[ref.index]);
  }

  private getClue(ref: LineRef): number[] {
    return ref.kind === 'row' ? this.puzzle.rowClues[ref.index] : this.puzzle.colClues[ref.index];
  }
}

function lineKey(ref: LineRef): string {
  return `${ref.kind}:${ref.index}`;
}

/**
 * Odtwarza solver z zapisanej historii kroków (persistencja sesji).
 * Kolejka startuje ze wszystkimi liniami — dokładnie tak jak po undo() —
 * więc dalsze krokowanie jest poprawne niezależnie od tego, jak wyglądała
 * kolejka w chwili zapisu.
 */
export function restoreSolver(puzzle: Puzzle, steps: readonly SolveStep[]): Solver {
  const solver = new Solver(puzzle);
  for (const step of steps) {
    for (const d of step.deductions) {
      solver.grid[d.row][d.col] = d.value;
    }
    solver.steps.push(step);
  }
  return solver;
}
