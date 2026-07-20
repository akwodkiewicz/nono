import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import Board from './Board';
import HistoryPanel from './HistoryPanel';
import SolverControls from './SolverControls';
import StepExplanation from './StepExplanation';

export default function SolverView() {
  // Skróty klawiaturowe: spacja/→ = krok dalej, ← = cofnij. Pomijamy zdarzenia
  // z pól i przycisków (spacja na sfokusowanym przycisku już "klika").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      if (target.isContentEditable) return;
      const s = useAppStore.getState();
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (s.status !== 'solved' && s.status !== 'contradiction') s.stepOnce();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (s.steps.length > 0) s.undoStep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setView = useAppStore((s) => s.setView);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setView('editor')}
        className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
      >
        ← Edytor wskazówek
      </button>
      <SolverControls />
      <StepExplanation />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <Board />
        </div>
        <div className="w-full shrink-0 lg:w-64">
          <HistoryPanel />
        </div>
      </div>
    </div>
  );
}
