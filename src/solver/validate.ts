import { normalizeClue } from './line';
import { puzzleHeight, puzzleWidth, type LineRef, type Puzzle } from './types';

export interface ValidationIssue {
  message: string;
  line?: LineRef;
}

/** Minimalna długość linii mieszczącej wskazówkę (bloki + pojedyncze przerwy). */
export function minLineLength(clue: readonly number[]): number {
  const blocks = normalizeClue(clue);
  if (blocks.length === 0) return 0;
  return blocks.reduce((sum, block) => sum + block, 0) + blocks.length - 1;
}

function sumClues(clues: readonly number[][]): number {
  return clues.reduce((sum, clue) => sum + normalizeClue(clue).reduce((s, b) => s + b, 0), 0);
}

/**
 * Sprawdza spójność definicji zagadki przed uruchomieniem solvera.
 * Zwraca listę problemów (pusta = zagadka poprawna). Tam gdzie to możliwe,
 * problem wskazuje konkretną linię — to pomaga poprawiać błędy odczytu OCR.
 */
export function validatePuzzle(puzzle: Puzzle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const width = puzzleWidth(puzzle);
  const height = puzzleHeight(puzzle);

  if (width === 0 || height === 0) {
    issues.push({ message: 'Zagadka musi mieć co najmniej 1 wiersz i 1 kolumnę.' });
    return issues;
  }

  const checkLines = (clues: number[][], kind: LineRef['kind'], maxLength: number) => {
    const label = kind === 'row' ? 'Wiersz' : 'Kolumna';
    clues.forEach((clue, index) => {
      const line: LineRef = { kind, index };
      for (const block of clue) {
        if (!Number.isInteger(block) || block < 0) {
          issues.push({
            message: `${label} ${index + 1}: niepoprawna wartość bloku (${block}).`,
            line,
          });
          return;
        }
      }
      const min = minLineLength(clue);
      if (min > maxLength) {
        issues.push({
          message: `${label} ${index + 1}: bloki [${normalizeClue(clue).join(', ')}] wymagają ${min} komórek, a linia ma ${maxLength}.`,
          line,
        });
      }
    });
  };

  checkLines(puzzle.rowClues, 'row', width);
  checkLines(puzzle.colClues, 'col', height);

  const rowSum = sumClues(puzzle.rowClues);
  const colSum = sumClues(puzzle.colClues);
  if (rowSum !== colSum) {
    issues.push({
      message: `Suma wskazówek wierszy (${rowSum}) różni się od sumy kolumn (${colSum}) – gdzieś jest błąd w danych.`,
    });
  }

  return issues;
}
