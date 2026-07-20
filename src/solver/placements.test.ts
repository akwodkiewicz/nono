import { describe, expect, it } from 'vitest';
import { TOTAL_CAP, enumeratePlacements } from './placements';
import { EMPTY, FILLED, UNKNOWN, type Cell } from './types';

const U = UNKNOWN;
const F = FILLED;
const E = EMPTY;

function unknowns(n: number): Cell[] {
  return Array<Cell>(n).fill(U);
}

describe('enumeratePlacements', () => {
  it('wylicza wszystkie ułożenia pustej linii w porządku od lewej', () => {
    const result = enumeratePlacements(unknowns(5), [2, 1], 10);
    expect(result).toEqual({
      placements: [
        [0, 3],
        [0, 4],
        [1, 4],
      ],
      total: 3,
    });
  });

  it('uwzględnia już oznaczone komórki', () => {
    // Komórka 0 pusta — blok 2 nie może zaczynać się w 0.
    expect(enumeratePlacements([E, U, U, U, U], [2, 1], 10)).toEqual({
      placements: [[1, 4]],
      total: 1,
    });
    // Komórka 4 wypełniona — blok 1 musi ją pokrywać.
    expect(enumeratePlacements([U, U, U, U, F], [2, 1], 10)).toEqual({
      placements: [
        [0, 4],
        [1, 4],
      ],
      total: 2,
    });
  });

  it('zwraca jedno puste ułożenie dla pustej wskazówki', () => {
    expect(enumeratePlacements(unknowns(3), [], 10)).toEqual({ placements: [[]], total: 1 });
    expect(enumeratePlacements(unknowns(3), [0], 10)).toEqual({ placements: [[]], total: 1 });
  });

  it('zwraca null przy sprzeczności', () => {
    // Dwie wypełnione komórki rozdzielone pustą, a tylko jeden blok.
    expect(enumeratePlacements([F, E, F], [1], 10)).toBeNull();
    // Blok nie mieści się w linii.
    expect(enumeratePlacements(unknowns(3), [4], 10)).toBeNull();
  });

  it('przy obcięciu zwraca najbardziej lewe ułożenia plus najbardziej prawe', () => {
    const result = enumeratePlacements(unknowns(20), [1], 5);
    expect(result).toEqual({
      placements: [[0], [1], [2], [3], [19]],
      total: 20,
    });
  });

  it('nasyca licznik ułożeń na TOTAL_CAP', () => {
    const result = enumeratePlacements(unknowns(60), [1, 1, 1], 4);
    expect(result?.total).toBe(TOTAL_CAP);
    expect(result?.placements).toHaveLength(4);
    // Ostatni wpis to ułożenie najbardziej prawe.
    expect(result?.placements.at(-1)).toEqual([55, 57, 59]);
  });
});
