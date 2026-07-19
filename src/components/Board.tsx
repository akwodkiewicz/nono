import { useState, type ReactNode } from 'react';
import { normalizeClue } from '../solver/line';
import { EMPTY, FILLED, type LineRef } from '../solver/types';
import { useAppStore } from '../state/store';

function onLine(line: LineRef | undefined, row: number, col: number): boolean {
  if (!line) return false;
  return line.kind === 'row' ? line.index === row : line.index === col;
}

/** Wskazówka do wyświetlenia: pusta linia pokazywana jako pojedyncze 0. */
function displayClue(clue: number[]): number[] {
  const normalized = normalizeClue(clue);
  return normalized.length > 0 ? normalized : [0];
}

export default function Board() {
  const puzzle = useAppStore((s) => s.puzzle);
  const grid = useAppStore((s) => s.grid);
  const steps = useAppStore((s) => s.steps);
  const contradiction = useAppStore((s) => s.contradiction);
  const [zoom, setZoom] = useState<number | null>(null);

  if (!puzzle) return null;

  const height = puzzle.rowClues.length;
  const width = puzzle.colClues.length;
  const rowClues = puzzle.rowClues.map(displayClue);
  const colClues = puzzle.colClues.map(displayClue);

  const lastStep = steps[steps.length - 1];
  const changed = new Set(lastStep?.deductions.map((d) => `${d.row}:${d.col}`) ?? []);

  const autoSize = Math.max(12, Math.min(30, Math.floor(600 / Math.max(width, height))));
  const size = zoom ?? autoSize;
  const fontSize = Math.max(9, Math.round(size * 0.48));

  const rcMax = Math.max(1, ...rowClues.map((c) => c.length));
  const ccMax = Math.max(1, ...colClues.map((c) => c.length));

  const cells: ReactNode[] = [];

  // Wskazówki kolumn (wyrównane do dołu obszaru wskazówek).
  colClues.forEach((clue, c) => {
    clue.forEach((block, j) => {
      const highlight = contradiction
        ? onLine(contradiction, -1, c) && contradiction.kind === 'col'
          ? 'bg-red-100 text-red-700'
          : ''
        : lastStep && lastStep.line.kind === 'col' && lastStep.line.index === c
          ? 'bg-amber-100'
          : '';
      cells.push(
        <div
          key={`cc-${c}-${j}`}
          style={{
            gridColumn: rcMax + c + 1,
            gridRow: ccMax - clue.length + j + 1,
          }}
          className={`flex items-end justify-center pb-0.5 font-medium text-gray-700 ${
            (c + 1) % 5 === 0 && c < width - 1 ? 'border-r border-gray-300' : ''
          } ${highlight}`}
        >
          {block}
        </div>,
      );
    });
  });

  // Wskazówki wierszy (wyrównane do prawej).
  rowClues.forEach((clue, r) => {
    clue.forEach((block, j) => {
      const highlight = contradiction
        ? onLine(contradiction, r, -1) && contradiction.kind === 'row'
          ? 'bg-red-100 text-red-700'
          : ''
        : lastStep && lastStep.line.kind === 'row' && lastStep.line.index === r
          ? 'bg-amber-100'
          : '';
      cells.push(
        <div
          key={`rc-${r}-${j}`}
          style={{
            gridColumn: rcMax - clue.length + j + 1,
            gridRow: ccMax + r + 1,
          }}
          className={`flex items-center justify-end pr-1 font-medium text-gray-700 ${
            (r + 1) % 5 === 0 && r < height - 1 ? 'border-b border-gray-300' : ''
          } ${highlight}`}
        >
          {block}
        </div>,
      );
    });
  });

  // Komórki planszy.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const value = grid[r]?.[c];
      const isChanged = changed.has(`${r}:${c}`);
      const isOnActiveLine = !contradiction && onLine(lastStep?.line, r, c);
      const isOnConflictLine = contradiction && onLine(contradiction, r, c);

      const borders = [
        'border-r border-b',
        (c + 1) % 5 === 0 || c === width - 1 ? 'border-r-gray-800' : 'border-r-gray-300',
        (r + 1) % 5 === 0 || r === height - 1 ? 'border-b-gray-800' : 'border-b-gray-300',
        c === 0 ? 'border-l border-l-gray-800' : '',
        r === 0 ? 'border-t border-t-gray-800' : '',
      ].join(' ');

      let content: ReactNode = null;
      let background = 'bg-white';
      if (value === FILLED) {
        background = isChanged ? 'bg-amber-500' : 'bg-gray-900';
      } else if (value === EMPTY) {
        content = (
          <span className={isChanged ? 'font-bold text-amber-600' : 'text-gray-300'}>·</span>
        );
        background = isChanged ? 'bg-amber-50' : 'bg-white';
      }
      if (value !== FILLED) {
        if (isOnConflictLine) background = 'bg-red-50';
        else if (isOnActiveLine && !isChanged) background = 'bg-amber-50';
      }

      cells.push(
        <div
          key={`c-${r}-${c}`}
          style={{ gridColumn: rcMax + c + 1, gridRow: ccMax + r + 1 }}
          className={`flex items-center justify-center ${borders} ${background}`}
        >
          {content}
        </div>,
      );
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
        <span>Zoom</span>
        <input
          type="range"
          min={10}
          max={40}
          value={size}
          onChange={(e) => setZoom(Number.parseInt(e.target.value, 10))}
        />
      </div>
      <div className="overflow-auto rounded-lg border border-gray-200 bg-white p-4">
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
    </div>
  );
}
