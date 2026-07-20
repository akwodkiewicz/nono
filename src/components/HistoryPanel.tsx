import { useEffect, useRef } from 'react';
import { describeStepShort } from '../state/stepText';
import { useAppStore } from '../state/store';

/**
 * List of executed steps; clicking shows the board state after a given step
 * (a preview — it does not undo the solver). The last entry returns to the
 * current state.
 */
export default function HistoryPanel() {
  const steps = useAppStore((s) => s.steps);
  const viewStep = useAppStore((s) => s.viewStep);
  const setViewStep = useAppStore((s) => s.setViewStep);
  const listRef = useRef<HTMLOListElement>(null);

  const current = viewStep ?? steps.length - 1;

  useEffect(() => {
    // Auto-scroll to the current step. Deliberately NOT scrollIntoView: when
    // the element is outside the viewport it also scrolls the whole page and
    // buttons "escape" from under the cursor. We scroll only the inner list
    // container.
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-active=true]');
    if (!list || !active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.top < listRect.top) {
      list.scrollTop += activeRect.top - listRect.top;
    } else if (activeRect.bottom > listRect.bottom) {
      list.scrollTop += activeRect.bottom - listRect.bottom;
    }
  }, [current, steps.length]);

  if (steps.length === 0) {
    return (
      <aside className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Historia kroków pojawi się tutaj.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold">Historia</h3>
        {viewStep !== null && (
          <button
            onClick={() => setViewStep(null)}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            wróć do bieżącego
          </button>
        )}
      </div>
      {viewStep !== null && (
        <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
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
                  ? 'bg-blue-100 font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
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
