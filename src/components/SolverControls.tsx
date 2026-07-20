import { describeStep, lineLabel } from '../state/stepText';
import { useAppStore, type CheckResult } from '../state/store';
import { UNKNOWN } from '../solver/types';

const BUTTON =
  'rounded border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40';

function checkMessage(result: CheckResult | null): { text: string; cls: string } {
  if (!result) {
    return {
      text: 'Tapnij komórkę na planszy, aby sprawdzić, czy jest zamalowana w ostatecznym rozwiązaniu — reszta rozwiązania pozostaje ukryta.',
      cls: 'text-emerald-800',
    };
  }
  const label = `Pole w${result.row + 1}, k${result.col + 1}`;
  switch (result.state) {
    case 'filled':
      return { text: `${label}: zamalowane w rozwiązaniu.`, cls: 'text-emerald-700' };
    case 'empty':
      return { text: `${label}: puste w rozwiązaniu.`, cls: 'text-sky-700' };
    case 'unknown':
      return {
        text: `${label}: nieznane — solver nie wyznacza tej komórki bez zgadywania.`,
        cls: 'text-amber-700',
      };
    case 'invalid':
      return {
        text: 'Wskazówki są sprzeczne — pełne rozwiązanie nie istnieje, sprawdzanie pól nie ma sensu.',
        cls: 'text-red-700',
      };
  }
}

export default function SolverControls() {
  const status = useAppStore((s) => s.status);
  const steps = useAppStore((s) => s.steps);
  const grid = useAppStore((s) => s.grid);
  const contradiction = useAppStore((s) => s.contradiction);
  const autoPlay = useAppStore((s) => s.autoPlay);
  const checkMode = useAppStore((s) => s.checkMode);
  const checkResult = useAppStore((s) => s.checkResult);
  const stepOnce = useAppStore((s) => s.stepOnce);
  const runAll = useAppStore((s) => s.runAll);
  const undoStep = useAppStore((s) => s.undoStep);
  const toggleAuto = useAppStore((s) => s.toggleAuto);
  const toggleCheckMode = useAppStore((s) => s.toggleCheckMode);
  const startSolver = useAppStore((s) => s.startSolver);
  const setView = useAppStore((s) => s.setView);

  const total = grid.length * (grid[0]?.length ?? 0);
  const known = grid.flat().filter((c) => c !== UNKNOWN).length;
  const finished = status === 'solved' || status === 'contradiction';
  const lastStep = steps[steps.length - 1];

  let statusText: string;
  let statusClass: string;
  switch (status) {
    case 'ready':
      statusText = 'Gotowy do rozwiązywania.';
      statusClass = 'text-gray-600';
      break;
    case 'progress':
      statusText = `W trakcie: ${known}/${total} komórek pewnych.`;
      statusClass = 'text-blue-700';
      break;
    case 'solved':
      statusText = `Rozwiązane w ${steps.length} krokach.`;
      statusClass = 'text-green-700';
      break;
    case 'stuck':
      statusText = `Solver utknął (${known}/${total} komórek): dalszy postęp wymagałby zgadywania, a solver używa wyłącznie pewnych wniosków.`;
      statusClass = 'text-amber-700';
      break;
    case 'contradiction':
      statusText = `Sprzeczność w ${contradiction ? lineLabel(contradiction) : 'danych'} — sprawdź wskazówki (częsta przyczyna: błąd odczytu ze zdjęcia).`;
      statusClass = 'text-red-700';
      break;
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={stepOnce} disabled={finished || autoPlay} className={BUTTON}>
          1 krok
        </button>
        <button onClick={toggleAuto} disabled={finished} className={BUTTON}>
          {autoPlay ? '⏸ Pauza' : '▶ Auto'}
        </button>
        <button onClick={runAll} disabled={finished || autoPlay} className={BUTTON}>
          Do końca
        </button>
        <button onClick={undoStep} disabled={steps.length === 0 || autoPlay} className={BUTTON}>
          Cofnij
        </button>
        <button
          onClick={toggleCheckMode}
          className={
            checkMode
              ? 'rounded border border-emerald-400 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100'
              : BUTTON
          }
        >
          Sprawdź pole
        </button>
        <button onClick={startSolver} className={BUTTON}>
          Od nowa
        </button>
        <span className="ml-auto text-sm text-gray-500">Krok {steps.length}</span>
        <button onClick={() => setView('editor')} className={BUTTON}>
          Wróć do edycji
        </button>
      </div>
      <p className={`text-sm font-medium ${statusClass}`}>{statusText}</p>
      {lastStep && status !== 'ready' && (
        <p className="text-sm text-gray-600">{describeStep(lastStep)}</p>
      )}
      {checkMode &&
        (() => {
          const message = checkMessage(checkResult);
          return (
            <p
              className={`rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium ${message.cls}`}
            >
              {message.text}
            </p>
          );
        })()}
    </div>
  );
}
