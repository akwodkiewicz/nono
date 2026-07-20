import { useState, type ReactNode } from 'react';
import { gridAfterSteps } from '../solver/history';
import { TOTAL_CAP, enumeratePlacements } from '../solver/placements';
import { EMPTY, FILLED, type Cell, type SolveStep } from '../solver/types';
import { lineLabel } from '../state/stepText';
import { useAppStore } from '../state/store';
import CellX from './CellX';

/** Ile ułożeń pokazywać w wizualizacji, zanim zaczniemy obcinać. */
const PLACEMENT_LIMIT = 8;

function MiniLine({
  label,
  cells,
  highlight,
}: {
  label: string;
  cells: readonly Cell[];
  /** Pozycje wydedukowane w tym kroku — wyróżnione we wszystkich wierszach. */
  highlight?: ReadonlySet<number>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-right text-xs text-gray-500">{label}</span>
      <div className="flex w-max">
        {cells.map((cell, i) => {
          const marked = highlight?.has(i) ?? false;
          let cls = 'bg-white';
          let content: ReactNode = null;
          if (cell === FILLED) {
            cls = marked ? 'bg-amber-500' : 'bg-gray-800';
          } else if (cell === EMPTY) {
            content = <CellX className={marked ? 'text-amber-600' : 'text-gray-300'} />;
            if (marked) cls = 'bg-amber-100';
          }
          return (
            <div
              key={i}
              className={`flex h-4 w-4 shrink-0 items-center justify-center border border-gray-300 ${cls}`}
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
    // Nie powinno się zdarzyć dla zapisanego kroku (krok = brak sprzeczności).
    return <p className="text-sm text-red-700">Brak legalnych ułożeń dla tej linii.</p>;
  }
  const truncated = result.total > result.placements.length;
  const totalText = result.total >= TOTAL_CAP ? `co najmniej ${TOTAL_CAP}` : String(result.total);

  return (
    <div className="space-y-2 overflow-x-auto pb-1">
      <p className="text-sm text-gray-600">
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
        <p className="text-xs text-gray-500">
          Pokazano {result.placements.length} z {totalText} ułożeń — najbardziej lewe i najbardziej
          prawe; pozostałe mieszczą się pomiędzy nimi.
        </p>
      )}
      <MiniLine label="wniosek" cells={lineAfter} highlight={deduced} />
    </div>
  );
}

/**
 * Rozwijany panel "dlaczego ten krok": wizualizacja legalnych ułożeń bloków
 * w analizowanej linii. Dotyczy kroku pokazywanego na planszy (podgląd
 * historii albo ostatni wykonany).
 */
export default function StepExplanation() {
  const puzzle = useAppStore((s) => s.puzzle);
  const steps = useAppStore((s) => s.steps);
  const viewStep = useAppStore((s) => s.viewStep);
  const [open, setOpen] = useState(false);

  if (!puzzle || steps.length === 0) return null;
  const index = Math.min(viewStep ?? steps.length - 1, steps.length - 1);
  const step = steps[index];

  // Stan linii sprzed kroku — rekonstrukcja z historii (kroki to diffy).
  const height = puzzle.rowClues.length;
  const width = puzzle.colClues.length;
  const before = gridAfterSteps(height, width, steps, index - 1);
  const lineBefore =
    step.line.kind === 'row' ? before[step.line.index] : before.map((row) => row[step.line.index]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-blue-600 hover:underline"
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
