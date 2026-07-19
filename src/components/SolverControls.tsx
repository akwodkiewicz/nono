import { useAppStore } from '../state/store';
import { FILLED, UNKNOWN, type LineRef, type SolveStep } from '../solver/types';

function lineLabel(ref: LineRef): string {
  return ref.kind === 'row' ? `wierszu ${ref.index + 1}` : `kolumnie ${ref.index + 1}`;
}

function describeStep(step: SolveStep): string {
  const label = step.line.kind === 'row' ? 'Wiersz' : 'Kolumna';
  const filled = step.deductions.filter((d) => d.value === FILLED).length;
  const empty = step.deductions.length - filled;
  const parts = [];
  if (filled > 0) parts.push(`${filled} pełne`);
  if (empty > 0) parts.push(`${empty} puste`);
  return `${label} ${step.line.index + 1} [${step.clue.join(' ') || '0'}]: oznaczono ${parts.join(
    ' i ',
  )} — te komórki są takie same we wszystkich możliwych ułożeniach bloków.`;
}

const BUTTON = 'rounded border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40';

export default function SolverControls() {
  const status = useAppStore((s) => s.status);
  const steps = useAppStore((s) => s.steps);
  const grid = useAppStore((s) => s.grid);
  const contradiction = useAppStore((s) => s.contradiction);
  const stepOnce = useAppStore((s) => s.stepOnce);
  const runAll = useAppStore((s) => s.runAll);
  const undoStep = useAppStore((s) => s.undoStep);
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
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={stepOnce} disabled={finished} className={BUTTON}>
          1 krok
        </button>
        <button onClick={runAll} disabled={finished} className={BUTTON}>
          Do końca
        </button>
        <button onClick={undoStep} disabled={steps.length === 0} className={BUTTON}>
          Cofnij
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
    </div>
  );
}
