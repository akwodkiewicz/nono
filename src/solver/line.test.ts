import { describe, expect, it } from 'vitest';
import { normalizeClue, solveLine } from './line';
import { EMPTY, FILLED, UNKNOWN, type Cell } from './types';

/** '#' = FILLED, '.' = EMPTY, '?' = UNKNOWN */
function line(s: string): Cell[] {
  return [...s].map((ch) => (ch === '#' ? FILLED : ch === '.' ? EMPTY : UNKNOWN));
}

describe('normalizeClue', () => {
  it('usuwa zera ([0] to zapis pustej linii)', () => {
    expect(normalizeClue([0])).toEqual([]);
    expect(normalizeClue([2, 0, 3])).toEqual([2, 3]);
  });
});

describe('solveLine', () => {
  it('pusta wskazówka → wszystkie komórki puste', () => {
    expect(solveLine(line('?????'), [])).toEqual(line('.....'));
    expect(solveLine(line('?????'), [0])).toEqual(line('.....'));
  });

  it('blok wypełniający całą linię', () => {
    expect(solveLine(line('?????'), [5])).toEqual(line('#####'));
  });

  it('nakładanie się ułożeń: [8] w linii 10 wymusza środkowe 6 komórek', () => {
    expect(solveLine(line('??????????'), [8])).toEqual(line('??######??'));
  });

  it('wskazówka jednoznacznie wypełniająca linię: [1,1,1] w 5', () => {
    expect(solveLine(line('?????'), [1, 1, 1])).toEqual(line('#.#.#'));
  });

  it('zakotwiczony blok: [3] w 5 z wypełnioną pierwszą komórką', () => {
    expect(solveLine(line('#????'), [3])).toEqual(line('###..'));
  });

  it('wypełniona komórka w środku zawęża ułożenia: [2] w 5', () => {
    // Blok 2 pokrywający komórkę 2 to [1,2] albo [2,3] → skrajne komórki puste.
    expect(solveLine(line('??#??'), [2])).toEqual(line('.?#?.'));
  });

  it('respektuje komórki oznaczone jako puste: [2] w 5', () => {
    // EMPTY na pozycji 1 → ułożenia [2,3] i [3,4] → komórka 3 zawsze pełna,
    // komórka 0 nigdy (blok nie zmieści się przed przerwą).
    expect(solveLine(line('?.???'), [2])).toEqual(line('..?#?'));
  });

  it('brak nowych wniosków → linia bez zmian', () => {
    expect(solveLine(line('???'), [1])).toEqual(line('???'));
  });

  it('sprzeczność: blok dłuższy niż linia', () => {
    expect(solveLine(line('??'), [3])).toBeNull();
  });

  it('sprzeczność: dwie wypełnione komórki przy wskazówce [1]', () => {
    expect(solveLine(line('#?#'), [1])).toBeNull();
  });

  it('sprzeczność: wypełniona komórka przy pustej wskazówce', () => {
    expect(solveLine(line('?#?'), [])).toBeNull();
  });

  it('sprzeczność: wszystkie komórki puste, a wskazówka wymaga bloku', () => {
    expect(solveLine(line('..'), [1])).toBeNull();
  });

  it('nie zmienia już oznaczonych komórek', () => {
    expect(solveLine(line('#.#.#'), [1, 1, 1])).toEqual(line('#.#.#'));
  });
});
