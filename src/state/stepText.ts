import { FILLED, type LineRef, type SolveStep } from '../solver/types';

export function lineLabel(ref: LineRef): string {
  return ref.kind === 'row' ? `wierszu ${ref.index + 1}` : `kolumnie ${ref.index + 1}`;
}

export function describeStep(step: SolveStep): string {
  const label = step.line.kind === 'row' ? 'Wiersz' : 'Kolumna';
  const filled = step.deductions.filter((d) => d.value === FILLED).length;
  const empty = step.deductions.length - filled;
  const parts = [];
  if (filled > 0) parts.push(`${filled} pełne`);
  if (empty > 0) parts.push(`${empty} puste`);
  return `${label} ${step.line.index + 1} [${step.clue.join(' ') || '0'}]: oznaczono ${parts.join(
    ' i ',
  )} — te komórki są takie same we wszystkich możliwych ułożeniach bloków.`;
}

/** Krótki opis do listy historii. */
export function describeStepShort(step: SolveStep): string {
  const label = step.line.kind === 'row' ? 'W' : 'K';
  return `${label}${step.line.index + 1} [${step.clue.join(' ') || '0'}] +${step.deductions.length}`;
}
