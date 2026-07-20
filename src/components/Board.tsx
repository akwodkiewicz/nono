import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { gridAfterSteps } from '../solver/history';
import { normalizeClue } from '../solver/line';
import { EMPTY, FILLED, type LineRef } from '../solver/types';
import { useAppStore } from '../state/store';
import CellX from './CellX';

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

  // Rozróżnienie tapnięcia od przewijania/przeciągania: tap = mały ruch,
  // krótki czas. Scroll na dotyku kończy się pointercancel, więc nie wpada tu.
  const tapStart = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  // Szerokość kontenera (ResizeObserver) — domyślny rozmiar komórki dopasowuje
  // planszę do ekranu zamiast do stałej szerokości; kluczowe na telefonach.
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

  // Podgląd historii: plansza odtworzona z kroków 0..viewStep; sprzeczność
  // dotyczy tylko stanu bieżącego, więc w podglądzie jej nie pokazujemy.
  const viewingPast = viewStep !== null;
  const grid = viewingPast ? gridAfterSteps(height, width, steps, viewStep) : currentGrid;
  const contradiction = viewingPast ? undefined : contradictionNow;
  const lastStep = steps[viewStep ?? steps.length - 1];
  const changed = new Set(lastStep?.deductions.map((d) => `${d.row}:${d.col}`) ?? []);

  const rcMax = Math.max(1, ...rowClues.map((c) => c.length));
  const ccMax = Math.max(1, ...colClues.map((c) => c.length));

  // Tap w planszę: w trybie sprawdzania — odczyt komórki; poza nim strefy jak
  // w czytniku e-booków (lewa 1/3 = cofnij, reszta = krok dalej).
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

  // Dopasuj rozmiar komórki tak, żeby plansza (wskazówki + siatka) mieściła
  // się w szerokości kontenera; suwak zoomu nadpisuje dopasowanie.
  const widthUnits = rcMax * 0.9 + width;
  const fitSize = containerWidth
    ? Math.floor(containerWidth / widthUnits)
    : Math.floor(600 / Math.max(width, height));
  const autoSize = Math.max(6, Math.min(30, fitSize));
  const size = zoom ?? autoSize;
  const fontSize = Math.max(7, Math.round(size * 0.48));

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
        content = <CellX className={isChanged ? 'text-amber-600' : 'text-gray-300'} />;
        background = isChanged ? 'bg-amber-50' : 'bg-white';
      }
      if (value !== FILLED) {
        if (isOnConflictLine) background = 'bg-red-50';
        else if (isOnActiveLine && !isChanged) background = 'bg-amber-50';
      }

      // Marker sprawdzonego pola nadpisuje wygląd komórki — to jedyne miejsce,
      // w którym zdradzamy fragment pełnego rozwiązania.
      if (checkMode && checkResult && checkResult.row === r && checkResult.col === c) {
        if (checkResult.state === 'filled') {
          background = 'bg-emerald-500';
          content = <span className="font-bold text-white">✓</span>;
        } else if (checkResult.state === 'empty') {
          background = 'bg-sky-100';
          content = <span className="font-bold text-sky-700">✕</span>;
        } else {
          background = 'bg-gray-200';
          content = <span className="font-bold text-gray-600">?</span>;
        }
      }

      cells.push(
        <div
          key={`c-${r}-${c}`}
          data-row={r}
          data-col={c}
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
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <span>Zoom</span>
        <input
          type="range"
          min={6}
          max={40}
          value={size}
          onChange={(e) => setZoom(Number.parseInt(e.target.value, 10))}
        />
        {zoom !== null && (
          <button
            onClick={() => setZoom(null)}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs hover:bg-gray-100"
          >
            dopasuj
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {checkMode
            ? 'Tap w komórkę = sprawdzenie pola'
            : 'Tap: prawa strona — krok dalej, lewa ⅓ — cofnij'}
        </span>
      </div>
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (tapStart.current = null)}
        className="touch-manipulation select-none overflow-auto rounded-lg border border-gray-200 bg-white p-2 sm:p-4"
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
    </div>
  );
}
