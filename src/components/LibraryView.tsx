import { Plus, Trash } from '@phosphor-icons/react';
import { UNKNOWN } from '../solver/types';
import { useAppStore, type PuzzleEntry, type UiStatus } from '../state/store';
import PuzzleThumbnail from './PuzzleThumbnail';
import { IconButton } from './ui';

const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function dimensions(entry: PuzzleEntry): { width: number; height: number } {
  return {
    height: entry.puzzle?.rowClues.length ?? entry.rowTexts.length,
    width: entry.puzzle?.colClues.length ?? entry.colTexts.length,
  };
}

/** Odsetek zdecydowanych komórek (wypełnione lub puste) w bieżącym stanie. */
function decidedRatio(entry: PuzzleEntry): number {
  let total = 0;
  let decided = 0;
  for (const row of entry.grid) {
    for (const cell of row) {
      total += 1;
      if (cell !== UNKNOWN) decided += 1;
    }
  }
  return total > 0 ? decided / total : 0;
}

/** Etykieta i kolor statusu rozwiązywania dla znacznika na kafelku. */
function statusBadge(entry: PuzzleEntry): { label: string; className: string } {
  const status: UiStatus = entry.status;
  if (status === 'solved') return { label: 'rozwiązana', className: 'bg-success text-paper' };
  if (status === 'contradiction')
    return { label: 'sprzeczność', className: 'bg-danger text-paper' };
  if (entry.steps.length > 0)
    return { label: 'w toku', className: 'bg-accent-wash text-accent-text' };
  return { label: 'nierozpoczęta', className: 'bg-line text-muted' };
}

function PuzzleCard({ entry }: { entry: PuzzleEntry }) {
  const openPuzzle = useAppStore((s) => s.openPuzzle);
  const deletePuzzle = useAppStore((s) => s.deletePuzzle);
  const { width, height } = dimensions(entry);
  const badge = statusBadge(entry);
  const ratio = decidedRatio(entry);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openPuzzle(entry.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPuzzle(entry.id);
        }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-surface text-left transition-colors hover:border-accent focus:outline-none focus-visible:border-accent"
    >
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Usunąć tę zagadkę z biblioteki?')) deletePuzzle(entry.id);
        }}
        title="Usuń zagadkę"
        className="absolute right-1.5 top-1.5 z-10 border border-line bg-paper/90 shadow-sm backdrop-blur-sm transition-colors hover:text-danger"
      >
        <Trash size={14} weight="bold" />
      </IconButton>
      <div className="flex aspect-square items-center justify-center bg-paper p-3">
        <PuzzleThumbnail grid={entry.grid} width={width} height={height} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-sm text-ink">
            {width}×{height}
          </p>
          <p className="truncate text-xs text-muted">{dateFormat.format(entry.updatedAt)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
          title={ratio > 0 ? `Zdecydowano ${Math.round(ratio * 100)}% pól` : undefined}
        >
          {badge.label}
        </span>
      </div>
    </div>
  );
}

export default function LibraryView() {
  const puzzles = useAppStore((s) => s.puzzles);
  const newPuzzle = useAppStore((s) => s.newPuzzle);

  // Najnowsze (dodane / edytowane) na górze.
  const ordered = [...puzzles].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-4">
      <p className="max-w-[65ch] text-sm text-muted">
        Twoje zagadki są zapamiętane wraz z postępem rozwiązywania. Stuknij kafelek, żeby wrócić
        tam, gdzie skończyłeś, albo załóż nową.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={newPuzzle}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface text-muted transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:border-accent"
        >
          <Plus size={28} weight="bold" />
          <span className="text-sm font-medium">Nowa zagadka</span>
        </button>
        {ordered.map((entry) => (
          <PuzzleCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
