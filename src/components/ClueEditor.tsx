import { MAX_SIZE, parsePuzzle, useAppStore } from '../state/store';
import { parseClueText } from '../state/clueText';
import { validatePuzzle, type ValidationIssue } from '../solver/validate';

function ClueList({
  label,
  hint,
  texts,
  invalid,
  onChange,
}: {
  label: string;
  hint: string;
  texts: string[];
  invalid: (index: number) => boolean;
  onChange: (index: number, text: string) => void;
}) {
  return (
    <div>
      <h3 className="font-semibold">{label}</h3>
      <p className="mb-2 text-sm text-gray-500">{hint}</p>
      <ol className="space-y-1">
        {texts.map((text, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-6 text-right text-xs text-gray-400">{i + 1}</span>
            <input
              type="text"
              inputMode="numeric"
              value={text}
              onChange={(e) => onChange(i, e.target.value)}
              className={`w-full rounded border px-2 py-1 font-mono text-sm ${
                invalid(i)
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white focus:border-blue-400'
              } focus:outline-none`}
            />
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
    <label className="flex items-center gap-2 text-sm">
      {label}
      <input
        type="number"
        min={1}
        max={MAX_SIZE}
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 1)}
        className="w-16 rounded border border-gray-300 px-2 py-1"
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

  const rowParseError = (i: number) => parseClueText(rowTexts[i]) === null;
  const colParseError = (i: number) => parseClueText(colTexts[i]) === null;
  const hasParseErrors = rowTexts.some((_, i) => rowParseError(i)) || colTexts.some((_, i) => colParseError(i));

  const puzzle = hasParseErrors ? null : parsePuzzle(rowTexts, colTexts);
  const issues: ValidationIssue[] = puzzle ? validatePuzzle(puzzle) : [];
  const issueOnLine = (kind: 'row' | 'col', index: number) =>
    issues.some((issue) => issue.line?.kind === kind && issue.line.index === index);
  const canSolve = puzzle !== null && issues.length === 0;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <CountInput label="Wiersze:" value={rowTexts.length} onChange={setRowCount} />
        <CountInput label="Kolumny:" value={colTexts.length} onChange={setColCount} />
        <div className="ml-auto flex gap-2">
          <button
            onClick={loadExample}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          >
            Wczytaj przykład
          </button>
          <button
            onClick={clearClues}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          >
            Wyczyść
          </button>
        </div>
      </section>

      <section className="grid gap-6 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
        <ClueList
          label="Wiersze"
          hint="Od góry do dołu; liczby oddzielone spacjami. Pusta linia = pusty wiersz."
          texts={rowTexts}
          invalid={(i) => rowParseError(i) || issueOnLine('row', i)}
          onChange={setRowText}
        />
        <ClueList
          label="Kolumny"
          hint="Od lewej do prawej; liczby to bloki od góry."
          texts={colTexts}
          invalid={(i) => colParseError(i) || issueOnLine('col', i)}
          onChange={setColText}
        />
      </section>

      {(hasParseErrors || issues.length > 0) && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <ul className="list-inside list-disc space-y-1">
            {hasParseErrors && <li>Niektóre wskazówki zawierają coś innego niż liczby.</li>}
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}

      <button
        onClick={startSolver}
        disabled={!canSolve}
        className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Rozwiązuj
      </button>
    </div>
  );
}
