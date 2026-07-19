import { describe, expect, it } from 'vitest';
import { minLineLength, validatePuzzle } from './validate';

describe('minLineLength', () => {
  it('sumuje bloki i minimalne przerwy', () => {
    expect(minLineLength([])).toBe(0);
    expect(minLineLength([0])).toBe(0);
    expect(minLineLength([3])).toBe(3);
    expect(minLineLength([2, 3])).toBe(6);
    expect(minLineLength([1, 1, 1])).toBe(5);
  });
});

describe('validatePuzzle', () => {
  it('poprawna zagadka przechodzi bez uwag', () => {
    const issues = validatePuzzle({
      rowClues: [[1], [3], [1]],
      colClues: [[1], [3], [1]],
    });
    expect(issues).toEqual([]);
  });

  it('wykrywa pustą definicję', () => {
    expect(validatePuzzle({ rowClues: [], colClues: [] })).not.toHaveLength(0);
  });

  it('wykrywa wskazówkę niemieszczącą się w linii', () => {
    const issues = validatePuzzle({
      rowClues: [[2, 2], [1], [1]],
      colClues: [[1], [2], [3]],
    });
    expect(issues.some((i) => i.line?.kind === 'row' && i.line.index === 0)).toBe(true);
  });

  it('wykrywa różne sumy wierszy i kolumn', () => {
    const issues = validatePuzzle({
      rowClues: [[1], [1]],
      colClues: [[2], [1]],
    });
    expect(issues.some((i) => i.message.includes('Suma'))).toBe(true);
  });

  it('wykrywa niepoprawne wartości bloków', () => {
    const issues = validatePuzzle({
      rowClues: [[-1], [1.5]],
      colClues: [[1], [1]],
    });
    expect(issues.filter((i) => i.message.includes('niepoprawna'))).toHaveLength(2);
  });
});
