import { describe, expect, it } from 'vitest';
import { TOTAL_CAP, enumerateExplanatory, enumeratePlacements, placementCells } from './placements';
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

describe('enumerateExplanatory', () => {
  it('pojedynczy blok: same skrajne wystarczają (część wspólna = overlap)', () => {
    // Blok 3 w linii 5: overlap na komórce 2; skrajne w pełni to tłumaczą.
    expect(enumerateExplanatory(unknowns(5), [3])).toEqual({
      clue: [3],
      placements: [[0], [2]],
      total: 3,
    });
  });

  it('jedno ułożenie → jeden wiersz', () => {
    expect(enumerateExplanatory([E, U, U, U, U], [2, 1])).toEqual({
      clue: [2, 1],
      placements: [[1, 4]],
      total: 1,
    });
  });

  it('dokłada pośrednie, gdy skrajne fałszywie sugerują stałą komórkę', () => {
    // Blok 2 w linii 5: na skrajnych ([0] i [3]) komórka 2 jest pusta, ale w
    // rzeczywistości bywa wypełniona — trzeba pokazać ułożenie pośrednie.
    expect(enumerateExplanatory(unknowns(5), [2])).toEqual({
      clue: [2],
      placements: [[0], [1], [3]],
      total: 4,
    });
  });

  it('linia wieloblokowa: pośrednie łamią komórki stałe na skrajnych', () => {
    const result = enumerateExplanatory(unknowns(5), [1, 1]);
    expect(result).toEqual({
      clue: [1, 1],
      placements: [
        [0, 2],
        [1, 3],
        [2, 4],
      ],
      total: 6,
    });
    // Rzetelność: komórki stałe wśród pokazanych = komórki stałe wśród
    // wszystkich ułożeń (tu: brak — każda komórka jest gdzieś inna).
    const shown = result!.placements.map((s) => placementCells(5, result!.clue, s));
    for (let p = 0; p < 5; p++) {
      const constShown = shown.every((c) => c[p] === shown[0][p]);
      expect(constShown).toBe(false);
    }
  });

  it('przy dużej swobodzie zwraca same skrajne (fallback bez enumeracji)', () => {
    expect(enumerateExplanatory(unknowns(70), [1])).toEqual({
      clue: [1],
      placements: [[0], [69]],
      total: 70,
    });
  });

  it('zwraca null przy sprzeczności', () => {
    expect(enumerateExplanatory([F, E, F], [1])).toBeNull();
  });
});
