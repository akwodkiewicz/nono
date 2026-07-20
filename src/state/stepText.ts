import type { LineRef, SolveStep } from '../solver/types';

export function lineLabel(ref: LineRef): string {
  return ref.kind === 'row' ? `wierszu ${ref.index + 1}` : `kolumnie ${ref.index + 1}`;
}

/** Krótki opis do listy historii. */
export function describeStepShort(step: SolveStep): string {
  const label = step.line.kind === 'row' ? 'W' : 'K';
  return `${label}${step.line.index + 1} [${step.clue.join(' ') || '0'}] +${step.deductions.length}`;
}
