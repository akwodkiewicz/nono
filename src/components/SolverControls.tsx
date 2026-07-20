import { lineLabel } from '../state/stepText';
import { useAppStore, type CheckResult } from '../state/store';
import { UNKNOWN } from '../solver/types';

const ICON_BUTTON =
  'flex h-9 w-11 items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40';

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

// Ikony transportu jako inline SVG — glify Unicode (⏮ ▶ ⏭ …) na części
// urządzeń mobilnych renderują się jako kolorowe emoji.
function IconStepBack() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="2.5" y="3" width="2" height="10" />
      <path d="M13.5 3 L6 8 L13.5 13 Z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5 L13.5 8 L4 13.5 Z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="3" width="3" height="10" />
      <rect x="9.5" y="3" width="3" height="10" />
    </svg>
  );
}

function IconStepForward() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M2.5 3 L10 8 L2.5 13 Z" />
      <rect x="11.5" y="3" width="2" height="10" />
    </svg>
  );
}

function IconRunToEnd() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.5 L7.5 8 L1.5 12.5 Z" />
      <path d="M8.5 3.5 L14.5 8 L8.5 12.5 Z" />
    </svg>
  );
}

function IconRestart() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8 3 a5 5 0 1 0 5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M8 0.5 L8 5.5 L11.8 3 Z" fill="currentColor" />
    </svg>
  );
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

  const total = grid.length * (grid[0]?.length ?? 0);
  const known = grid.flat().filter((c) => c !== UNKNOWN).length;
  const finished = status === 'solved' || status === 'contradiction';

  // Komunikat tylko dla stanów wymagających uwagi użytkownika; zwykły postęp
  // widać na planszy i liczniku kroków.
  let statusText: string | null = null;
  let statusClass = '';
  switch (status) {
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

  const autoLabel = autoPlay ? 'Pauza' : 'Auto';
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={undoStep}
          disabled={steps.length === 0 || autoPlay}
          title="Cofnij krok"
          aria-label="Cofnij krok"
          className={ICON_BUTTON}
        >
          <IconStepBack />
        </button>
        <button
          onClick={toggleAuto}
          disabled={finished}
          title={autoLabel}
          aria-label={autoLabel}
          className={ICON_BUTTON}
        >
          {autoPlay ? <IconPause /> : <IconPlay />}
        </button>
        <button
          onClick={stepOnce}
          disabled={finished || autoPlay}
          title="Następny krok"
          aria-label="Następny krok"
          className={ICON_BUTTON}
        >
          <IconStepForward />
        </button>
        <button
          onClick={runAll}
          disabled={finished || autoPlay}
          title="Do końca"
          aria-label="Do końca"
          className={ICON_BUTTON}
        >
          <IconRunToEnd />
        </button>
        <button
          onClick={startSolver}
          title="Od nowa"
          aria-label="Od nowa"
          className={ICON_BUTTON}
        >
          <IconRestart />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleCheckMode}
            className={
              checkMode
                ? 'rounded border border-emerald-400 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100'
                : 'rounded border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-gray-100'
            }
          >
            Sprawdź pole
          </button>
          <span className="text-sm text-gray-500">Krok {steps.length}</span>
        </div>
      </div>
      {statusText && <p className={`text-sm font-medium ${statusClass}`}>{statusText}</p>}
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
