import { useEffect, useRef, useState } from 'react';
import { DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react';
import { useAppStore } from '../state/store';
import { IconButton } from './ui';

/**
 * Overflow menu for the active puzzle, shown in the solver header. Since "back"
 * returns to the gallery, editing the definition is a deliberate action tucked
 * here rather than the primary back target; delete lives alongside it.
 */
export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setView = useAppStore((s) => s.setView);
  const deletePuzzle = useAppStore((s) => s.deletePuzzle);
  const activeId = useAppStore((s) => s.activeId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const edit = () => {
    setOpen(false);
    setView('editor');
  };
  const remove = () => {
    setOpen(false);
    if (activeId && window.confirm('Usunąć tę zagadkę z biblioteki?')) deletePuzzle(activeId);
  };

  return (
    <div ref={ref} className="relative ml-auto">
      <IconButton
        className="h-8 w-8"
        title="Więcej"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsThreeVertical size={18} weight="bold" />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={edit}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-ink/5"
          >
            <PencilSimple size={16} /> Edytuj zagadkę
          </button>
          <button
            role="menuitem"
            onClick={remove}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-wash"
          >
            <Trash size={16} /> Usuń zagadkę
          </button>
        </div>
      )}
    </div>
  );
}
