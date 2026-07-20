import { useState, type ReactNode } from 'react';
import { gridAfterSteps } from '../solver/history';
import { TOTAL_CAP, enumeratePlacements } from '../solver/placements';
import { EMPTY, FILLED, type Cell, type SolveStep } from '../solver/types';
import { lineLabel } from '../state/stepText';
import { useAppStore } from '../state/store';
import CellX from './CellX';

/** How many placements to visualize before truncating. */
const PLACEMENT_LIMIT = 8;

function MiniLine({
  label,
  cells,
  highlight,
}: {
  label: string;
  cells: readonly Cell[];
  /** Positions deduced in this step — emphasized in every row. */
  highlight?: ReadonlySet<number>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <div className="flex w-max">
        {cells.map((cell, i) => {
          const marked = highlight?.has(i) ?? false;
          let cls = 'bg-white dark:bg-gray-900';
          let content: ReactNode = null;
          if (cell === FILLED) {
            cls = marked ? 'bg-amber-500' : 'bg-gray-800 dark:bg-gray-200';
          } else if (cell === EMPTY) {
            content = (
              <CellX
                className={
                  marked ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'
                }
              />
            );
            if (marked) cls = 'bg-amber-100 dark:bg-amber-900';
          }
          return (
            <div
              key={i}
              className={`flex h-4 w-4 shrink-0 items-center justify-center border border-gray-300 dark:border-gray-600 ${cls}`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function placementCells(n: number, clue: readonly number[], starts: readonly number[]): Cell[] {
  const cells = Array<Cell>(n).fill(EMPTY);
  starts.forEach((start, i) => {
    for (let j = start; j < start + clue[i]; j++) cells[j] = FILLED;
  });
  return cells;
}

function Explanation({ step, lineBefore }: { step: SolveStep; lineBefore: Cell[] }) {
  const n = lineBefore.length;
  const result = enumeratePlacements(lineBefore, step.clue, PLACEMENT_LIMIT);

  const lineAfter = [...lineBefore];
  const deduced = new Set<number>();
  for (const d of step.deductions) {
    const pos = step.line.kind === 'row' ? d.col : d.row;
    lineAfter[pos] = d.value;
    deduced.add(pos);
  }

  if (!result) {
    // Should not happen for a recorded step (a step means no contradiction).
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Brak legalnych ułożeń dla tej linii.
      </p>
    );
  }
  const truncated = result.total > result.placements.length;
  const totalText = result.total >= TOTAL_CAP ? `co najmniej ${TOTAL_CAP}` : String(result.total);

  return (
    <div className="space-y-2 overflow-x-auto pb-1">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Solver wyznacza wszystkie ułożenia bloków [{step.clue.join(' ') || '0'}] w{' '}
        {lineLabel(step.line)} zgodne z dotychczasowym stanem. Komórki o tej samej wartości w
        każdym ułożeniu (wyróżnione) są pewne — to dokładnie wnioski tego kroku.
      </p>
      <MiniLine label="stan przed" cells={lineBefore} />
      {result.placements.map((starts, i) => (
        <MiniLine
          key={i}
          label={truncated && i === result.placements.length - 1 ? 'skrajnie prawe' : `ułożenie ${i + 1}`}
          cells={placementCells(n, step.clue, starts)}
          highlight={deduced}
        />
      ))}
      {truncated && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Pokazano {result.placements.length} z {totalText} ułożeń — najbardziej lewe i najbardziej
          prawe; pozostałe mieszczą się pomiędzy nimi.
        </p>
      )}
      <MiniLine label="wniosek" cells={lineAfter} highlight={deduced} />
    </div>
  );
}

/**
 * Collapsible "why this step" panel: a visualization of the legal block
 * placements in the analyzed line. Applies to the step shown on the board
 * (history preview or the last executed one).
 */
export default function StepExplanation() {
  const puzzle = useAppStore((s) => s.puzzle);
  const steps = useAppStore((s) => s.steps);
  const viewStep = useAppStore((s) => s.viewStep);
  const [open, setOpen] = useState(false);

  if (!puzzle || steps.length === 0) return null;
  const index = Math.min(viewStep ?? steps.length - 1, steps.length - 1);
  const step = steps[index];

  // Line state before the step — reconstructed from history (steps are diffs).
  const height = puzzle.rowClues.length;
  const width = puzzle.colClues.length;
  const before = gridAfterSteps(height, width, steps, index - 1);
  const lineBefore =
    step.line.kind === 'row' ? before[step.line.index] : before.map((row) => row[step.line.index]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {open ? '▾' : '▸'} Dlaczego ten krok? (krok {index + 1})
      </button>
      {open && (
        <div className="mt-3">
          <Explanation key={index} step={step} lineBefore={lineBefore} />
        </div>
      )}
    </section>
  );
}
