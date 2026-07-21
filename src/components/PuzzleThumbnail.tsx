import type { ReactNode } from 'react';
import { FILLED, type Grid } from '../solver/types';

/**
 * Read-only miniatura planszy do galerii: same wypełnione komórki jako kwadraty
 * na tle powierzchni, bez wskazówek i interakcji. Tania nawet dla 60×60 (jeden
 * <rect> na wypełnioną komórkę). Nierozpoczęta zagadka ma pusty grid — pokazuje
 * wtedy czystą planszę w wymiarach z liczby wskazówek.
 */
export default function PuzzleThumbnail({
  grid,
  width,
  height,
}: {
  grid: Grid;
  width: number;
  height: number;
}) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const rects: ReactNode[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r]?.[c] === FILLED) {
        rects.push(
          <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill="var(--color-ink)" />,
        );
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Podgląd planszy ${w}×${h}`}
      className="max-h-full max-w-full"
      style={{ width: '100%', height: '100%' }}
    >
      <rect x={0} y={0} width={w} height={h} fill="var(--color-surface)" />
      {rects}
    </svg>
  );
}
