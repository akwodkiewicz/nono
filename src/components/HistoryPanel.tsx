import { useEffect, useRef } from 'react';
import { describeStepShort } from '../state/stepText';
import { useAppStore } from '../state/store';

/**
 * Lista wykonanych kroków; kliknięcie pokazuje stan planszy po danym kroku
 * (podgląd — nie cofa solvera). Ostatnia pozycja wraca do stanu bieżącego.
 */
export default function HistoryPanel() {
  const steps = useAppStore((s) => s.steps);
  const viewStep = useAppStore((s) => s.viewStep);
  const setViewStep = useAppStore((s) => s.setViewStep);
  const listRef = useRef<HTMLOListElement>(null);

  const current = viewStep ?? steps.length - 1;

  useEffect(() => {
    // Autoprzewijanie do bieżącego kroku (istotne w trybie auto).
    const list = listRef.current;
    const active = list?.querySelector('[data-active=true]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [current, steps.length]);

  if (steps.length === 0) {
    return (
      <aside className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Historia kroków pojawi się tutaj.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold">Historia</h3>
        {viewStep !== null && (
          <button
            onClick={() => setViewStep(null)}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            wróć do bieżącego
          </button>
        )}
      </div>
      {viewStep !== null && (
        <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          Podgląd kroku {viewStep + 1} z {steps.length} — plansza pokazuje stan historyczny.
        </p>
      )}
      <ol ref={listRef} className="max-h-80 space-y-0.5 overflow-y-auto text-sm">
        {steps.map((step, i) => (
          <li key={i}>
            <button
              data-active={i === current}
              onClick={() => setViewStep(i)}
              className={`w-full rounded px-2 py-0.5 text-left font-mono text-xs ${
                i === current
                  ? 'bg-blue-100 font-semibold text-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {i + 1}. {describeStepShort(step)}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
