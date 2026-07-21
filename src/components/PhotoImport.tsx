import { useRef, useState } from 'react';
import { Image as ImageIcon, Plus, X } from '@phosphor-icons/react';
import { readCluesFromPhoto, type OcrLine, type Orientation } from '../ocr/pipeline';
import { useAppStore } from '../state/store';
import { Button, IconButton, Panel } from './ui';

interface SlotState {
  running: boolean;
  progress: number; // 0..1
  lines: OcrLine[] | null;
  texts: string[] | null;
  error: string | null;
}

const idleSlot: SlotState = { running: false, progress: 0, lines: null, texts: null, error: null };

/** Border color based on the weakest OCR confidence in the line. */
function confidenceClass(line: OcrLine): string {
  const worst = Math.min(100, ...line.tokens.map((t) => (t.value === null ? 0 : t.confidence)));
  if (worst < 60) return 'border-danger bg-danger-wash';
  if (worst < 85) return 'border-accent bg-accent-wash';
  return 'border-line bg-paper';
}

function FilePicker({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>
        <ImageIcon size={15} /> {label}
      </Button>
      <span className="truncate text-xs text-muted">{name ?? 'nie wybrano pliku'}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setName(file.name);
            onFile(file);
          }
        }}
      />
    </div>
  );
}

function PhotoSlot({
  title,
  hint,
  lineLabel,
  slot,
  onFile,
  onTextChange,
  onInsertLine,
  onDeleteLine,
}: {
  title: string;
  hint: string;
  lineLabel: string;
  slot: SlotState;
  onFile: (file: File) => void;
  onTextChange: (index: number, text: string) => void;
  /** Inserts an empty line AFTER the given index (-1 = at the beginning). */
  onInsertLine: (index: number) => void;
  onDeleteLine: (index: number) => void;
}) {
  return (
    <Panel className="space-y-3 p-4 sm:p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <FilePicker label="Wybierz zdjęcie" onFile={onFile} />
      {slot.running && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.round(slot.progress * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            Rozpoznawanie… {Math.round(slot.progress * 100)}%
          </p>
        </div>
      )}
      {slot.error && <p className="text-sm text-danger">Błąd: {slot.error}</p>}
      {slot.texts && slot.lines && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Odczytano {slot.texts.length} linii. Porównaj wycinki z odczytem i popraw błędy –
            znak <span className="font-mono text-ink">?</span> oznacza nierozpoznaną liczbę. Liczby
            rozdzielaj spacją, kropką lub przecinkiem. Brakującą linię dodasz przyciskiem{' '}
            <span className="font-mono text-ink">+</span> (wstawia poniżej), nadmiarową usuniesz{' '}
            <span className="font-mono text-ink">✕</span>.
          </p>
          <Button variant="quiet" size="sm" onClick={() => onInsertLine(-1)} className="-ml-1">
            <Plus size={13} weight="bold" /> dodaj linię na początku
          </Button>
          <ol className="space-y-1.5">
            {slot.texts.map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right font-mono text-xs text-muted">
                  {lineLabel} {i + 1}
                </span>
                <span className="flex max-w-[45%] shrink-0 items-center gap-0.5 overflow-x-auto">
                  {slot.lines![i].tokens.map((token, j) => (
                    <img
                      key={j}
                      src={token.crop}
                      alt={token.value === null ? '?' : String(token.value)}
                      title={`pewność ${token.confidence}%`}
                      className="h-6 rounded border border-line"
                    />
                  ))}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={text}
                  onChange={(e) => onTextChange(i, e.target.value)}
                  className={`w-full rounded-lg border px-2 py-1 font-mono text-sm text-ink focus:outline-none ${confidenceClass(
                    slot.lines![i],
                  )}`}
                />
                <IconButton onClick={() => onInsertLine(i)} title="Wstaw linię poniżej">
                  <Plus size={14} weight="bold" />
                </IconButton>
                <IconButton
                  onClick={() => onDeleteLine(i)}
                  disabled={slot.texts!.length <= 1}
                  title="Usuń tę linię"
                >
                  <X size={14} weight="bold" />
                </IconButton>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}

export default function PhotoImport() {
  const [rowsSlot, setRowsSlot] = useState<SlotState>(idleSlot);
  const [colsSlot, setColsSlot] = useState<SlotState>(idleSlot);
  const setRowTexts = useAppStore((s) => s.setRowTexts);
  const setColTexts = useAppStore((s) => s.setColTexts);
  const setView = useAppStore((s) => s.setView);

  const process = (orientation: Orientation, file: File) => {
    const setSlot = orientation === 'rows' ? setRowsSlot : setColsSlot;
    setSlot({ ...idleSlot, running: true });
    readCluesFromPhoto(file, orientation, (done, total) => {
      setSlot((s) => ({ ...s, progress: total > 0 ? done / total : 0 }));
    })
      .then((lines) => {
        const texts = lines.map((line) =>
          line.tokens.map((t) => (t.value === null ? '?' : String(t.value))).join(' '),
        );
        setSlot({ running: false, progress: 1, lines, texts, error: null });
      })
      .catch((err: unknown) => {
        setSlot({ ...idleSlot, error: err instanceof Error ? err.message : String(err) });
      });
  };

  const editText = (orientation: Orientation) => (index: number, text: string) => {
    const setSlot = orientation === 'rows' ? setRowsSlot : setColsSlot;
    setSlot((s) => ({
      ...s,
      texts: s.texts ? s.texts.map((t, i) => (i === index ? text : t)) : s.texts,
    }));
  };

  // Manual structure correction when segmentation lost a line or added a
  // phantom one: an inserted line has no OCR crops (empty tokens).
  const insertLine = (orientation: Orientation) => (index: number) => {
    const setSlot = orientation === 'rows' ? setRowsSlot : setColsSlot;
    setSlot((s) => {
      if (!s.texts || !s.lines) return s;
      const texts = [...s.texts];
      const lines = [...s.lines];
      texts.splice(index + 1, 0, '');
      lines.splice(index + 1, 0, { tokens: [] });
      return { ...s, texts, lines };
    });
  };

  const deleteLine = (orientation: Orientation) => (index: number) => {
    const setSlot = orientation === 'rows' ? setRowsSlot : setColsSlot;
    setSlot((s) => {
      if (!s.texts || !s.lines || s.texts.length <= 1) return s;
      return {
        ...s,
        texts: s.texts.filter((_, i) => i !== index),
        lines: s.lines.filter((_, i) => i !== index),
      };
    });
  };

  const canApply = rowsSlot.texts !== null || colsSlot.texts !== null;
  const apply = () => {
    if (rowsSlot.texts) setRowTexts(rowsSlot.texts);
    if (colsSlot.texts) setColTexts(colsSlot.texts);
    setView('editor');
  };

  return (
    <div className="space-y-4">
      <p className="max-w-[65ch] text-sm text-muted">
        Zrób dwa zdjęcia wskazówek: osobno wierszy i osobno kolumn – łatwiej objąć je ostro
        w kadrze niż całą zagadkę naraz. Fotografuj prostopadle, przy równym świetle.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <PhotoSlot
          title="Wskazówki wierszy (zdjęcie pionowe)"
          hint="Kolumna liczb z lewej strony zagadki, od góry do dołu."
          lineLabel="w."
          slot={rowsSlot}
          onFile={(f) => process('rows', f)}
          onTextChange={editText('rows')}
          onInsertLine={insertLine('rows')}
          onDeleteLine={deleteLine('rows')}
        />
        <PhotoSlot
          title="Wskazówki kolumn (zdjęcie poziome)"
          hint="Liczby nad zagadką, od lewej do prawej."
          lineLabel="k."
          slot={colsSlot}
          onFile={(f) => process('cols', f)}
          onTextChange={editText('cols')}
          onInsertLine={insertLine('cols')}
          onDeleteLine={deleteLine('cols')}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="lg" onClick={apply} disabled={!canApply}>
          Przenieś do edytora
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setView('editor')}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
