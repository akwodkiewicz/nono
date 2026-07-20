import { lineLabel } from '../state/stepText';
import { useAppStore, type CheckResult } from '../state/store';
import { UNKNOWN } from '../solver/types';

function checkMessage(result: CheckResult | null): { text: string; cls: string } {
  if (!result) {
    return {
      text: 'Tapnij komórkę na planszy, aby sprawdzić, czy jest zamalowana w ostatecznym rozwiązaniu — reszta rozwiązania pozostaje ukryta.',
      cls: 'text-emerald-800 dark:text-emerald-300',
    };
  }
  const label = `Pole w${result.row + 1}, k${result.col + 1}`;
  switch (result.state) {
    case 'filled':
      return {
        text: `${label}: zamalowane w rozwiązaniu.`,
        cls: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'empty':
      return { text: `${label}: puste w rozwiązaniu.`, cls: 'text-sky-700 dark:text-sky-400' };
    case 'unknown':
      return {
        text: `${label}: nieznane — solver nie wyznacza tej komórki bez zgadywania.`,
        cls: 'text-amber-700 dark:text-amber-400',
      };
    case 'invalid':
      return {
        text: 'Wskazówki są sprzeczne — pełne rozwiązanie nie istnieje, sprawdzanie pól nie ma sensu.',
        cls: 'text-red-700 dark:text-red-400',
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

  // A message only for states that need the user's attention; regular
  // progress is visible on the board and the step counter.
  let statusText: string | null = null;
  let statusClass = '';
  switch (status) {
    case 'solved':
      statusText = `Rozwiązane w ${steps.length} krokach.`;
      statusClass = 'text-green-700 dark:text-green-400';
      break;
    case 'stuck':
      statusText = `Solver utknął (${known}/${total} komórek): dalszy postęp wymagałby zgadywania, a solver używa wyłącznie pewnych wniosków.`;
      statusClass = 'text-amber-700 dark:text-amber-400';
      break;
    case 'contradiction':
      statusText = `Sprzeczność w ${contradiction ? lineLabel(contradiction) : 'danych'} — sprawdź wskazówki (częsta przyczyna: błąd odczytu ze zdjęcia).`;
      statusClass = 'text-red-700 dark:text-red-400';
      break;
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={toggleCheckMode}
          className={
            checkMode
              ? 'rounded border border-emerald-400 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900'
              : 'rounded border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800'
          }
        >
          Sprawdź pole
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">Krok {steps.length}</span>
      </div>
      {statusText && <p className={`text-sm font-medium ${statusClass}`}>{statusText}</p>}
      {checkMode &&
        (() => {
          const message = checkMessage(checkResult);
          return (
            <p
              className={`rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium dark:border-emerald-900 dark:bg-emerald-950 ${message.cls}`}
            >
              {message.text}
            </p>
          );
        })()}
    </div>
  );
}
