import { ArrowLeft } from '@phosphor-icons/react';
import ClueEditor from './components/ClueEditor';
import PhotoImport from './components/PhotoImport';
import SolverView from './components/SolverView';
import { IconButton } from './components/ui';
import { useAppStore, type View } from './state/store';

/** Header title and back target per view. The future 'assistant' view
 *  (docs/tryb-pomocnika.md) adds one entry here. */
const VIEW_META: Record<View, { title: string; back?: View }> = {
  editor: { title: 'Edytor' },
  import: { title: 'Import ze zdjęć', back: 'editor' },
  solver: { title: 'Rozwiązywanie', back: 'editor' },
};

/** Wordmark glyph: a 2x2 mini-nonogram (two solved cells, one fresh deduction,
 *  one still empty) echoing the favicon. */
function Mark() {
  return (
    <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="0.5" y="0.5" width="7" height="7" fill="var(--color-ink)" />
      <rect x="8.5" y="8.5" width="7" height="7" fill="var(--color-ink)" />
      <rect x="8.5" y="0.5" width="7" height="7" fill="var(--color-accent)" />
      <rect
        x="1"
        y="9"
        width="6"
        height="6"
        fill="none"
        stroke="var(--color-grid)"
        strokeWidth="1"
      />
    </svg>
  );
}

export default function App() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const meta = VIEW_META[view];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-4">
          {meta.back && (
            <IconButton
              className="-ml-2 h-8 w-8"
              title="Wróć do edytora"
              onClick={() => setView(meta.back!)}
            >
              <ArrowLeft size={16} />
            </IconButton>
          )}
          <Mark />
          <h1 className="text-lg font-semibold leading-none tracking-tight">nono</h1>
          <span aria-hidden="true" className="h-4 w-px bg-line" />
          <span className="truncate text-sm leading-none text-muted">{meta.title}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {view === 'editor' && <ClueEditor />}
        {view === 'import' && <PhotoImport />}
        {view === 'solver' && <SolverView />}
      </main>
    </div>
  );
}
