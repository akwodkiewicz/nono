import ClueEditor from './components/ClueEditor';
import PhotoImport from './components/PhotoImport';
import SolverView from './components/SolverView';
import { useAppStore } from './state/store';

export default function App() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-baseline gap-3">
          <h1 className="text-xl font-bold">nono</h1>
          <span className="text-sm text-gray-500">solver nonogramów</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        {view === 'editor' && <ClueEditor />}
        {view === 'import' && <PhotoImport />}
        {view === 'solver' && <SolverView />}
      </main>
    </div>
  );
}
