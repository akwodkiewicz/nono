import Board from './Board';
import HistoryPanel from './HistoryPanel';
import SolverControls from './SolverControls';

export default function SolverView() {
  return (
    <div className="space-y-4">
      <SolverControls />
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
