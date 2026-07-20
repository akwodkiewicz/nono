import { describe, expect, it } from 'vitest';
import { parsePuzzleJson, puzzleToJson } from './puzzleJson';

describe('puzzleJson', () => {
  it('round-trip eksport → import', () => {
    const puzzle = { rowClues: [[1], [3], []], colClues: [[2], [1, 1], [2]] };
    expect(parsePuzzleJson(puzzleToJson(puzzle))).toEqual(puzzle);
  });

  it('akceptuje aliasy rows/cols', () => {
    expect(parsePuzzleJson('{"rows": [[1]], "cols": [[1]]}')).toEqual({
      rowClues: [[1]],
      colClues: [[1]],
    });
  });

  it('odrzuca niepoprawne struktury', () => {
    expect(parsePuzzleJson('nie-json')).toBeNull();
    expect(parsePuzzleJson('{"rowClues": [[1]]}')).toBeNull();
    expect(parsePuzzleJson('{"rowClues": [["a"]], "colClues": [[1]]}')).toBeNull();
    expect(parsePuzzleJson('{"rowClues": [[1.5]], "colClues": [[1]]}')).toBeNull();
    expect(parsePuzzleJson('{"rowClues": [], "colClues": [[1]]}')).toBeNull();
  });
});
