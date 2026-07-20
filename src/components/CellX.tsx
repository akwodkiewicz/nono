/**
 * Thin X across the cell diagonals — the "certainly empty" mark.
 * vector-effect keeps the stroke at 1px regardless of cell size (zoom).
 */
export default function CellX({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={`h-full w-full ${className}`} aria-hidden="true">
      <path
        d="M2 2 L8 8 M8 2 L2 8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
