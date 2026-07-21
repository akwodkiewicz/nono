import { useRef, useState } from 'react';
import { Camera, Plus, X } from '@phosphor-icons/react';
import { MAX_SIZE, parsePuzzle, useAppStore } from '../state/store';
import { formatClue, parseClueText } from '../state/clueText';
import { parsePuzzleJson, puzzleToJson } from '../state/puzzleJson';
import { validatePuzzle, type ValidationIssue } from '../solver/validate';
import { ActionBar, Button, IconButton, Menu, Panel } from './ui';

function ClueList({
  label,
  hint,
  texts,
  invalid,
  onChange,
  onReplace,
}: {
  label: string;
  hint: string;
  texts: string[];
  invalid: (index: number) => boolean;
  onChange: (index: number, text: string) => void;
  /** Replaces the whole list — for inserting/removing lines in the middle. */
  onReplace: (texts: string[]) => void;
}) {
  const insertAfter = (index: number) => {
    const next = [...texts];
    next.splice(index + 1, 0, '');
    onReplace(next);
  };
  const remove = (index: number) => {
    if (texts.length <= 1) return;
    onReplace(texts.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h3 className="font-semibold">{label}</h3>
      <p className="mb-2 text-sm text-muted">{hint}</p>
      <Button variant="quiet" size="sm" onClick={() => insertAfter(-1)} className="mb-1 -ml-1">
        <Plus size={13} weight="bold" /> dodaj linię na początku
      </Button>
      <ol className="space-y-1">
        {texts.map((text, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-6 text-right font-mono text-xs text-muted">{i + 1}</span>
            <input
              type="text"
              inputMode="decimal"
              value={text}
              onChange={(e) => onChange(i, e.target.value)}
              className={`w-full rounded-lg border px-2 py-1 font-mono text-sm focus:outline-none ${
                invalid(i)
                  ? 'border-danger bg-danger-wash text-ink'
                  : 'border-line bg-paper focus:border-accent'
              }`}
            />
            <IconButton onClick={() => insertAfter(i)} title="Wstaw linię poniżej">
              <Plus size={14} weight="bold" />
            </IconButton>
            <IconButton onClick={() => remove(i)} disabled={texts.length <= 1} title="Usuń tę linię">
              <X size={14} weight="bold" />
            </IconButton>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <input
        type="number"
        min={1}
        max={MAX_SIZE}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 1)}
        className="w-16 rounded-lg border border-line bg-paper px-2 py-1 font-mono text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

export default function ClueEditor() {
  const rowTexts = useAppStore((s) => s.rowTexts);
  const colTexts = useAppStore((s) => s.colTexts);
  const setRowText = useAppStore((s) => s.setRowText);
  const setColText = useAppStore((s) => s.setColText);
  const setRowCount = useAppStore((s) => s.setRowCount);
  const setColCount = useAppStore((s) => s.setColCount);
  const loadExample = useAppStore((s) => s.loadExample);
  const clearClues = useAppStore((s) => s.clearClues);
  const startSolver = useAppStore((s) => s.startSolver);
  const setView = useAppStore((s) => s.setView);
  const setRowTexts = useAppStore((s) => s.setRowTexts);
  const setColTexts = useAppStore((s) => s.setColTexts);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const rowParseError = (i: number) => parseClueText(rowTexts[i]) === null;
  const colParseError = (i: number) => parseClueText(colTexts[i]) === null;
  const hasParseErrors =
    rowTexts.some((_, i) => rowParseError(i)) || colTexts.some((_, i) => colParseError(i));

  const puzzle = hasParseErrors ? null : parsePuzzle(rowTexts, colTexts);
  const issues: ValidationIssue[] = puzzle ? validatePuzzle(puzzle) : [];
  const issueOnLine = (kind: 'row' | 'col', index: number) =>
    issues.some((issue) => issue.line?.kind === kind && issue.line.index === index);
  const canSolve = puzzle !== null && issues.length === 0;

  const exportJson = () => {
    if (!puzzle) return;
    const blob = new Blob([puzzleToJson(puzzle)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nonogram.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const imported = parsePuzzleJson(await file.text());
    if (!imported) {
      setImportError(
        `Nie udało się odczytać ${file.name} – oczekiwany format: {"rowClues": [[...]], "colClues": [[...]]}.`,
      );
      return;
    }
    setImportError(null);
    setRowTexts(imported.rowClues.map(formatClue));
    setColTexts(imported.colClues.map(formatClue));
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <CountInput label="Wiersze:" value={rowTexts.length} onChange={setRowCount} />
        <CountInput label="Kolumny:" value={colTexts.length} onChange={setColCount} />
        <div className="ml-auto flex items-center gap-1.5">
          <Menu
            label="Więcej działań"
            items={[
              { label: 'Wczytaj przykład', onSelect: loadExample },
              { label: 'Import JSON', onSelect: () => importInputRef.current?.click() },
              { label: 'Eksport JSON', onSelect: exportJson, disabled: !puzzle },
              { label: 'Wyczyść', onSelect: clearClues },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={() => setView('import')}>
            <Camera size={15} /> Wczytaj ze zdjęć
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      {importError && (
        <p className="border-l-2 border-danger py-1 pl-3 text-sm text-danger">{importError}</p>
      )}

      <Panel className="grid gap-6 p-4 sm:p-5 md:grid-cols-2">
        <ClueList
          label="Wiersze"
          hint="Od góry do dołu; liczby rozdzielaj spacją, kropką lub przecinkiem. Pusta linia = pusty wiersz."
          texts={rowTexts}
          invalid={(i) => rowParseError(i) || issueOnLine('row', i)}
          onChange={setRowText}
          onReplace={setRowTexts}
        />
        <ClueList
          label="Kolumny"
          hint="Od lewej do prawej; liczby to bloki od góry."
          texts={colTexts}
          invalid={(i) => colParseError(i) || issueOnLine('col', i)}
          onChange={setColText}
          onReplace={setColTexts}
        />
      </Panel>

      {(hasParseErrors || issues.length > 0) && (
        <div className="border-l-2 border-danger py-1 pl-3 text-sm text-danger">
          <ul className="list-inside list-disc space-y-1">
            {hasParseErrors && <li>Niektóre wskazówki zawierają coś innego niż liczby.</li>}
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          onClick={startSolver}
          disabled={!canSolve}
          className="w-full sm:w-auto"
        >
          Rozwiązuj
        </Button>
      </ActionBar>
    </div>
  );
}
