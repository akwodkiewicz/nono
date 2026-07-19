import type { Puzzle } from './types';

/** Wskazówka (lista bloków) dla pojedynczej linii rozwiązania. */
export function lineToClue(cells: readonly boolean[]): number[] {
  const clue: number[] = [];
  let run = 0;
  for (const filled of cells) {
    if (filled) {
      run++;
    } else if (run > 0) {
      clue.push(run);
      run = 0;
    }
  }
  if (run > 0) clue.push(run);
  return clue;
}

/** Wyznacza definicję zagadki z gotowego rozwiązania (true = wypełniona). */
export function cluesFromGrid(solution: readonly boolean[][]): Puzzle {
  const width = solution[0]?.length ?? 0;
  const rowClues = solution.map((row) => lineToClue(row));
  const colClues = Array.from({ length: width }, (_, c) =>
    lineToClue(solution.map((row) => row[c])),
  );
  return { rowClues, colClues };
}

/** Zamienia "ASCII art" ('#' = wypełniona) na siatkę rozwiązania. */
export function gridFromStrings(art: readonly string[]): boolean[][] {
  return art.map((row) => [...row].map((ch) => ch === '#'));
}
