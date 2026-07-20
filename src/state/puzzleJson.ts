import type { Puzzle } from '../solver/types';

/** Format pliku: { "rowClues": [[...]], "colClues": [[...]] }. */
export function puzzleToJson(puzzle: Puzzle): string {
  return JSON.stringify(puzzle, null, 2);
}

function isClueList(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (clue) =>
        Array.isArray(clue) &&
        clue.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0),
    )
  );
}

/**
 * Akceptuje też aliasy rows/cols oraz ver/hor (spotykany format eksportu:
 * "ver" to linie ze zdjęcia pionowego = wiersze, "hor" z poziomego = kolumny).
 * Zwraca null, gdy struktura się nie zgadza.
 */
export function parsePuzzleJson(text: string): Puzzle | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const rowClues = obj.rowClues ?? obj.rows ?? obj.ver;
  const colClues = obj.colClues ?? obj.cols ?? obj.hor;
  if (!isClueList(rowClues) || !isClueList(colClues)) return null;
  return { rowClues, colClues };
}
