import Board from './Board';
import SolverControls from './SolverControls';

export default function SolverView() {
  return (
    <div className="space-y-4">
      <SolverControls />
      <Board />
    </div>
  );
}
