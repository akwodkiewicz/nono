import { useEffect } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import { useAppStore } from '../state/store';
import Board from './Board';
import HistoryPanel from './HistoryPanel';
import SolverControls from './SolverControls';
import StepExplanation from './StepExplanation';
import { Button } from './ui';

export default function SolverView() {
  // Keyboard shortcuts: Space/→ = next step, ← = undo. Events from inputs and
  // buttons are ignored (Space on a focused button already "clicks" it).
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
      <Button variant="quiet" size="sm" onClick={() => setView('editor')} className="-ml-1">
        <ArrowLeft size={15} /> Edytor wskazówek
      </Button>
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
