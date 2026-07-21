import { MagnifyingGlass } from '@phosphor-icons/react';
import { lineLabel } from '../state/stepText';
import { useAppStore, type CheckResult } from '../state/store';
import { UNKNOWN } from '../solver/types';

function checkMessage(result: CheckResult | null): { text: string; cls: string } {
  if (!result) {
    return {
      text: 'Tapnij komórkę na planszy, aby sprawdzić, czy jest zamalowana w ostatecznym rozwiązaniu – reszta rozwiązania pozostaje ukryta.',
      cls: 'text-muted',
    };
  }
  const label = `Pole w${result.row + 1}, k${result.col + 1}`;
  switch (result.state) {
    case 'filled':
      return { text: `${label}: zamalowane w rozwiązaniu.`, cls: 'text-success' };
    case 'empty':
      return { text: `${label}: puste w rozwiązaniu.`, cls: 'text-ink' };
    case 'unknown':
      return {
        text: `${label}: nieznane – solver nie wyznacza tej komórki bez zgadywania.`,
        cls: 'text-accent-text',
      };
    case 'invalid':
      return {
        text: 'Wskazówki są sprzeczne – pełne rozwiązanie nie istnieje, sprawdzanie pól nie ma sensu.',
        cls: 'text-danger',
      };
  }
}

export default function SolverControls() {
  const status = useAppStore((s) => s.status);
  const steps = useAppStore((s) => s.steps);
  const grid = useAppStore((s) => s.grid);
  const contradiction = useAppStore((s) => s.contradiction);
  const checkMode = useAppStore((s) => s.checkMode);
  const checkResult = useAppStore((s) => s.checkResult);
  const toggleCheckMode = useAppStore((s) => s.toggleCheckMode);

  const total = grid.length * (grid[0]?.length ?? 0);
  const known = grid.flat().filter((c) => c !== UNKNOWN).length;

  // A terminal-state chip in the bar plus a longer detail line below it. The
  // 'solved' state needs no detail line (the chip and step counter say it all);
  // 'stuck' and 'contradiction' keep their sentence, and the contradiction line
  // reference is diagnostically important.
  let chip: { label: string; cls: string } | null = null;
  let detailText: string | null = null;
  let detailClass = '';
  switch (status) {
    case 'solved':
      chip = { label: 'Rozwiązane', cls: 'border-success text-success' };
      break;
    case 'stuck':
      chip = { label: 'Utknął', cls: 'border-accent text-accent-text' };
      detailText = `Solver utknął (${known}/${total} komórek): dalszy postęp wymagałby zgadywania, a solver używa wyłącznie pewnych wniosków.`;
      detailClass = 'border-accent text-accent-text';
      break;
    case 'contradiction':
      chip = { label: 'Sprzeczność', cls: 'border-danger text-danger' };
      detailText = `Sprzeczność w ${contradiction ? lineLabel(contradiction) : 'danych'} – sprawdź wskazówki (częsta przyczyna: błąd odczytu ze zdjęcia).`;
      detailClass = 'border-danger text-danger';
      break;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={toggleCheckMode}
          aria-pressed={checkMode}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 motion-safe:active:scale-[0.98] ${
            checkMode
              ? 'border-accent bg-accent-wash text-accent-text'
              : 'border-line bg-surface text-ink hover:bg-ink/5'
          }`}
        >
          <MagnifyingGlass size={15} /> Sprawdź pole
        </button>
        {chip && (
          <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
            {chip.label}
          </span>
        )}
        <span className="ml-auto font-mono text-sm text-muted">
          Krok {steps.length}
          <span className="ml-3 text-xs">
            {known}/{total} pól
          </span>
        </span>
      </div>
      {detailText && (
        <p className={`border-l-2 py-1 pl-3 text-sm font-medium ${detailClass}`}>{detailText}</p>
      )}
      {checkMode &&
        (() => {
          const message = checkMessage(checkResult);
          return (
            <p className={`border-l-2 border-accent py-1 pl-3 text-sm font-medium ${message.cls}`}>
              {message.text}
            </p>
          );
        })()}
    </div>
  );
}
