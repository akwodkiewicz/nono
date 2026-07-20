import { useState } from 'react';
import { readCluesFromPhoto, type OcrLine, type Orientation } from '../ocr/pipeline';
import { useAppStore } from '../state/store';

interface SlotState {
  running: boolean;
  progress: number; // 0..1
  lines: OcrLine[] | null;
  texts: string[] | null;
  error: string | null;
}

const idleSlot: SlotState = { running: false, progress: 0, lines: null, texts: null, error: null };

/** Kolor obwódki wg najsłabszej pewności OCR w linii. */
function confidenceClass(line: OcrLine): string {
  const worst = Math.min(100, ...line.tokens.map((t) => (t.value === null ? 0 : t.confidence)));
  if (worst < 60) return 'border-red-400 bg-red-50';
  if (worst < 85) return 'border-amber-400 bg-amber-50';
  return 'border-gray-300 bg-white';
}

const ICON_BUTTON =
  'shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30';

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
  /** Wstawia pustą linię PO podanym indeksie (-1 = na początku). */
  onInsertLine: (index: number) => void;
  onDeleteLine: (index: number) => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
      />
      {slot.running && (
        <div>
          <div className="h-2 overflow-hidden rounded bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.round(slot.progress * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Rozpoznawanie… {Math.round(slot.progress * 100)}%
          </p>
        </div>
      )}
      {slot.error && <p className="text-sm text-red-600">Błąd: {slot.error}</p>}
      {slot.texts && slot.lines && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Odczytano {slot.texts.length} linii. Porównaj wycinki z odczytem i popraw błędy —
            znak <span className="font-mono">?</span> oznacza nierozpoznaną liczbę. Liczby
            rozdzielaj spacją, kropką lub przecinkiem. Brakującą linię dodasz przyciskiem{' '}
            <span className="font-mono">+</span> (wstawia poniżej), nadmiarową usuniesz{' '}
            <span className="font-mono">✕</span>.
          </p>
          <button onClick={() => onInsertLine(-1)} className={ICON_BUTTON}>
            + dodaj linię na początku
          </button>
          <ol className="space-y-1.5">
            {slot.texts.map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs text-gray-400">
                  {lineLabel} {i + 1}
                </span>
                <span className="flex max-w-[45%] shrink-0 items-center gap-0.5 overflow-x-auto">
                  {slot.lines![i].tokens.map((token, j) => (
                    <img
                      key={j}
                      src={token.crop}
                      alt={token.value === null ? '?' : String(token.value)}
                      title={`pewność ${token.confidence}%`}
                      className="h-6 rounded border border-gray-200"
                    />
                  ))}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={text}
                  onChange={(e) => onTextChange(i, e.target.value)}
                  className={`w-full rounded border px-2 py-1 font-mono text-sm focus:outline-none ${confidenceClass(
                    slot.lines![i],
                  )}`}
                />
                <button
                  onClick={() => onInsertLine(i)}
                  title="Wstaw linię poniżej"
                  className={ICON_BUTTON}
                >
                  +
                </button>
                <button
                  onClick={() => onDeleteLine(i)}
                  disabled={slot.texts!.length <= 1}
                  title="Usuń tę linię"
                  className={ICON_BUTTON}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
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

  // Ręczna korekta struktury, gdy segmentacja zgubiła linię albo dodała
  // fantomową: wstawiona linia nie ma wycinków OCR (pusty tokens).
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
      <p className="text-sm text-gray-600">
        Zrób dwa zdjęcia wskazówek: osobno wierszy i osobno kolumn — łatwiej objąć je ostro
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
        <button
          onClick={apply}
          disabled={!canApply}
          className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Przenieś do edytora
        </button>
        <button
          onClick={() => setView('editor')}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-semibold hover:bg-gray-100"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
