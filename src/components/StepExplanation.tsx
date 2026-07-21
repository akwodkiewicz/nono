import { useState, type ReactNode } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { gridAfterSteps } from '../solver/history';
import { enumerateExplanatory, placementCells } from '../solver/placements';
import { EMPTY, FILLED, type Cell, type SolveStep } from '../solver/types';
import { useAppStore } from '../state/store';
import CellX from './CellX';
import { Panel } from './ui';

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
      <span className="w-24 shrink-0 text-right text-xs text-muted">{label}</span>
      <div className="flex w-max">
        {cells.map((cell, i) => {
          const marked = highlight?.has(i) ?? false;
          let cls = 'bg-surface';
          let content: ReactNode = null;
          if (cell === FILLED) {
            cls = marked ? 'bg-accent' : 'bg-ink';
          } else if (cell === EMPTY) {
            content = <CellX className={marked ? 'text-accent-text' : 'text-grid'} />;
            if (marked) cls = 'bg-accent-wash';
          }
          return (
            <div
              key={i}
              className={`flex h-4 w-4 shrink-0 items-center justify-center border border-grid ${cls}`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Label for a shown placement given its position among the shown ones. */
function placementLabel(i: number, count: number): string {
  if (count === 1) return 'jedyne ułożenie';
  if (i === 0) return 'skrajnie lewe';
  if (i === count - 1) return 'skrajnie prawe';
  return 'ułożenie pośrednie';
}

function Explanation({ step, lineBefore }: { step: SolveStep; lineBefore: Cell[] }) {
  const n = lineBefore.length;
  const result = enumerateExplanatory(lineBefore, step.clue);

  const lineAfter = [...lineBefore];
  const deduced = new Set<number>();
  for (const d of step.deductions) {
    const pos = step.line.kind === 'row' ? d.col : d.row;
    lineAfter[pos] = d.value;
    deduced.add(pos);
  }

  if (!result) {
    // Should not happen for a recorded step (a step means no contradiction).
    return <p className="text-sm text-danger">Brak legalnych ułożeń dla tej linii.</p>;
  }

  const count = result.placements.length;
  return (
    <div className="space-y-2 overflow-x-auto pb-1">
      <MiniLine label="stan przed" cells={lineBefore} />
      {result.placements.map((starts, i) => (
        <MiniLine
          key={i}
          label={placementLabel(i, count)}
          cells={placementCells(n, result.clue, starts)}
          highlight={deduced}
        />
      ))}
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
    <Panel className="p-3 sm:p-4">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
      >
        <CaretRight
          size={14}
          weight="bold"
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        Wytłumaczenie ruchu
      </button>
      {open && (
        <div className="mt-3">
          <Explanation key={index} step={step} lineBefore={lineBefore} />
        </div>
      )}
    </Panel>
  );
}
