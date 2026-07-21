import { useEffect, useRef } from 'react';
import { describeStepShort } from '../state/stepText';
import { useAppStore } from '../state/store';
import { Button, Panel } from './ui';

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
      <Panel className="p-4 text-sm text-muted">Historia kroków pojawi się tutaj.</Panel>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold">Historia</h3>
        {viewStep !== null && (
          <Button variant="quiet" size="sm" onClick={() => setViewStep(null)}>
            wróć do bieżącego
          </Button>
        )}
      </div>
      {viewStep !== null && (
        <p className="mb-2 border-l-2 border-accent py-1 pl-3 text-xs text-accent-text">
          Podgląd kroku {viewStep + 1} z {steps.length} – plansza pokazuje stan historyczny.
        </p>
      )}
      <ol ref={listRef} className="max-h-80 space-y-0.5 overflow-y-auto text-sm">
        {steps.map((step, i) => (
          <li key={i}>
            <button
              data-active={i === current}
              onClick={() => setViewStep(i)}
              className={`w-full rounded-lg px-2 py-1 text-left font-mono text-xs transition-colors ${
                i === current
                  ? 'bg-accent-wash font-semibold text-accent-text'
                  : 'text-muted hover:bg-ink/5 hover:text-ink'
              }`}
            >
              {i + 1}. {describeStepShort(step)}
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
