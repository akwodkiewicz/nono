import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Check, Question, X } from '@phosphor-icons/react';
import { gridAfterSteps } from '../solver/history';
import { normalizeClue } from '../solver/line';
import { EMPTY, FILLED, type LineRef } from '../solver/types';
import { useAppStore } from '../state/store';
import CellX from './CellX';
import { Button } from './ui';

function onLine(line: LineRef | undefined, row: number, col: number): boolean {
  if (!line) return false;
  return line.kind === 'row' ? line.index === row : line.index === col;
}

/** Clue for display: an empty line is shown as a single 0. */
function displayClue(clue: number[]): number[] {
  const normalized = normalizeClue(clue);
  return normalized.length > 0 ? normalized : [0];
}

export default function Board() {
  const puzzle = useAppStore((s) => s.puzzle);
  const currentGrid = useAppStore((s) => s.grid);
  const steps = useAppStore((s) => s.steps);
  const viewStep = useAppStore((s) => s.viewStep);
  const contradictionNow = useAppStore((s) => s.contradiction);
  const status = useAppStore((s) => s.status);
  const checkMode = useAppStore((s) => s.checkMode);
  const checkResult = useAppStore((s) => s.checkResult);
  const stepOnce = useAppStore((s) => s.stepOnce);
  const undoStep = useAppStore((s) => s.undoStep);
  const checkCell = useAppStore((s) => s.checkCell);
  const [zoom, setZoom] = useState<number | null>(null);

  // Telling a tap apart from a scroll/drag: a tap is a small movement within
  // a short time. Touch scrolling ends with pointercancel, so it never lands
  // here.
  const tapStart = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  // Container width (ResizeObserver) — the default cell size fits the board
  // to the screen instead of a fixed width; crucial on phones.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!puzzle) return null;

  const height = puzzle.rowClues.length;
  const width = puzzle.colClues.length;
  const rowClues = puzzle.rowClues.map(displayClue);
  const colClues = puzzle.colClues.map(displayClue);

  // History preview: the board reconstructed from steps 0..viewStep; the
  // contradiction applies only to the current state, so it is hidden in the
  // preview.
  const viewingPast = viewStep !== null;
  const grid = viewingPast ? gridAfterSteps(height, width, steps, viewStep) : currentGrid;
  const contradiction = viewingPast ? undefined : contradictionNow;
  const stepIndex = viewStep ?? steps.length - 1;
  const lastStep = steps[stepIndex];
  const changed = new Set(lastStep?.deductions.map((d) => `${d.row}:${d.col}`) ?? []);
  // Remount key for freshly-changed cells so cell-pop replays each step.
  const popKey = viewStep ?? steps.length;

  const rcMax = Math.max(1, ...rowClues.map((c) => c.length));
  const ccMax = Math.max(1, ...colClues.map((c) => c.length));

  // Tapping the board: in check mode — read a cell; otherwise e-book-style
  // zones (left 1/3 = undo, the rest = next step).
  const finished = status === 'solved' || status === 'contradiction';
  const handleTap = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (checkMode) {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-row]');
      if (cell) checkCell(Number(cell.dataset.row), Number(cell.dataset.col));
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) {
      if (steps.length > 0) undoStep();
    } else if (!finished) {
      stepOnce();
    }
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = tapStart.current;
    tapStart.current = null;
    if (!start || start.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
    if (Date.now() - start.t > 500) return;
    handleTap(e);
  };

  // Fit the cell size so that the board (clues + grid) fits the container
  // width; the zoom slider overrides the fit.
  const widthUnits = rcMax * 0.9 + width;
  const fitSize = containerWidth
    ? Math.floor(containerWidth / widthUnits)
    : Math.floor(600 / Math.max(width, height));
  const autoSize = Math.max(6, Math.min(30, fitSize));
  const size = zoom ?? autoSize;
  const fontSize = Math.max(7, Math.round(size * 0.48));

  const cells: ReactNode[] = [];

  // Column clues (aligned to the bottom of the clue area).
  colClues.forEach((clue, c) => {
    const active = !contradiction && lastStep?.line.kind === 'col' && lastStep.line.index === c;
    const conflict = contradiction?.kind === 'col' && contradiction.index === c;
    const highlight = conflict
      ? 'bg-danger-wash text-danger'
      : active
        ? 'bg-accent-wash text-accent-text font-bold'
        : '';
    clue.forEach((block, j) => {
      cells.push(
        <div
          key={`cc-${c}-${j}`}
          style={{ gridColumn: rcMax + c + 1, gridRow: ccMax - clue.length + j + 1 }}
          className={`flex items-end justify-center pb-0.5 font-mono text-ink ${
            (c + 1) % 5 === 0 && c < width - 1 ? 'border-r border-grid' : ''
          } ${highlight}`}
        >
          {block}
        </div>,
      );
    });
  });

  // Row clues (aligned to the right).
  rowClues.forEach((clue, r) => {
    const active = !contradiction && lastStep?.line.kind === 'row' && lastStep.line.index === r;
    const conflict = contradiction?.kind === 'row' && contradiction.index === r;
    const highlight = conflict
      ? 'bg-danger-wash text-danger'
      : active
        ? 'bg-accent-wash text-accent-text font-bold'
        : '';
    clue.forEach((block, j) => {
      cells.push(
        <div
          key={`rc-${r}-${j}`}
          style={{ gridColumn: rcMax - clue.length + j + 1, gridRow: ccMax + r + 1 }}
          className={`flex items-center justify-end pr-1 font-mono text-ink ${
            (r + 1) % 5 === 0 && r < height - 1 ? 'border-b border-grid' : ''
          } ${highlight}`}
        >
          {block}
        </div>,
      );
    });
  });

  // Board cells.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const value = grid[r]?.[c];
      const isChanged = changed.has(`${r}:${c}`);
      const isOnActiveLine = !contradiction && onLine(lastStep?.line, r, c);
      const isOnConflictLine = contradiction && onLine(contradiction, r, c);

      const borders = [
        'border-r border-b',
        (c + 1) % 5 === 0 || c === width - 1 ? 'border-r-grid-strong' : 'border-r-grid',
        (r + 1) % 5 === 0 || r === height - 1 ? 'border-b-grid-strong' : 'border-b-grid',
        c === 0 ? 'border-l border-l-grid-strong' : '',
        r === 0 ? 'border-t border-t-grid-strong' : '',
      ].join(' ');

      let content: ReactNode = null;
      let background = 'bg-surface';
      let extra = '';
      if (value === FILLED) {
        background = isChanged ? 'bg-accent' : 'bg-ink';
        if (isChanged) extra = 'cell-pop';
      } else if (value === EMPTY) {
        content = <CellX className={isChanged ? 'text-accent-text' : 'text-grid'} />;
        background = isChanged ? 'bg-accent-wash' : 'bg-surface';
        if (isChanged) extra = 'cell-pop';
      }
      if (value !== FILLED) {
        if (isOnConflictLine) background = 'bg-danger-wash';
        else if (isOnActiveLine && !isChanged) background = 'bg-accent-wash';
      }

      // The checked-cell marker overrides the cell's look — the only place
      // where a fragment of the full solution is revealed.
      if (checkMode && checkResult && checkResult.row === r && checkResult.col === c) {
        if (checkResult.state === 'filled') {
          background = 'bg-success';
          content = <Check size="70%" weight="bold" className="text-paper" />;
        } else if (checkResult.state === 'empty') {
          background = 'bg-surface ring-2 ring-inset ring-ink';
          content = <X size="70%" weight="bold" className="text-ink" />;
        } else {
          background = 'bg-line';
          content = <Question size="70%" weight="bold" className="text-muted" />;
        }
      }

      cells.push(
        <div
          key={isChanged ? `c-${r}-${c}-${popKey}` : `c-${r}-${c}`}
          data-row={r}
          data-col={c}
          style={{ gridColumn: rcMax + c + 1, gridRow: ccMax + r + 1 }}
          className={`flex items-center justify-center ${borders} ${background} ${extra}`}
        >
          {content}
        </div>,
      );
    }
  }

  return (
    <div>
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (tapStart.current = null)}
        className="touch-manipulation select-none overflow-auto rounded-xl border border-line bg-surface p-2 shadow-board sm:p-4"
      >
        <div
          className="inline-grid"
          style={{
            gridTemplateColumns: `repeat(${rcMax}, ${Math.round(size * 0.9)}px) repeat(${width}, ${size}px)`,
            gridTemplateRows: `repeat(${ccMax}, ${Math.round(size * 0.9)}px) repeat(${height}, ${size}px)`,
            fontSize,
          }}
        >
          {cells}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Zoom</span>
        <input
          type="range"
          min={6}
          max={40}
          value={size}
          onChange={(e) => setZoom(Number.parseInt(e.target.value, 10))}
          aria-label="Powiększenie planszy"
        />
        {zoom !== null && (
          <Button variant="quiet" size="sm" onClick={() => setZoom(null)}>
            dopasuj
          </Button>
        )}
        <span className="ml-auto">
          {checkMode
            ? 'Tap w komórkę = sprawdzenie pola'
            : 'Tap: prawa strona – krok dalej, lewa ⅓ – cofnij'}
        </span>
      </div>
    </div>
  );
}
