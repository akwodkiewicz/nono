import { buildLineDp } from './line';
import { FILLED, type Cell } from './types';

/** Nasycenie licznika ułożeń — total nigdy nie przekracza tej wartości. */
export const TOTAL_CAP = 1000;

export interface PlacementEnumeration {
  /**
   * Ułożenia bloków jako listy pozycji startowych, od najbardziej lewych.
   * Przy obcięciu ostatni wpis to ułożenie najbardziej prawe — razem widać
   * pełny zakres swobody bloków.
   */
  placements: number[][];
  /** Liczba wszystkich legalnych ułożeń, nasycona na TOTAL_CAP. */
  total: number;
}

/**
 * Jawna enumeracja legalnych ułożeń bloków w linii, zgodnych z bieżącym
 * stanem komórek — materiał do wizualizacji "dlaczego ten krok": część
 * wspólna wszystkich ułożeń to dokładnie pewne dedukcje solvera.
 *
 * Zwraca null przy sprzeczności (żadne ułożenie nie pasuje). Gdy ułożeń jest
 * więcej niż `limit`, zwraca limit-1 najbardziej lewych oraz najbardziej prawe.
 */
export function enumeratePlacements(
  line: readonly Cell[],
  clueRaw: readonly number[],
  limit: number,
): PlacementEnumeration | null {
  const { clue, canComplete, canPlace } = buildLineDp(line, clueRaw);
  if (!canComplete[0][0]) return null;
  const n = line.length;
  const k = clue.length;

  // count[pos][blk] — liczba pełnych ułożeń osiągalnych ze stanu (nasycona).
  const count: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0));
  count[n][k] = 1;
  for (let pos = n - 1; pos >= 0; pos--) {
    count[pos][k] = line[pos] !== FILLED ? count[pos + 1][k] : 0;
  }
  for (let blk = k - 1; blk >= 0; blk--) {
    const len = clue[blk];
    for (let pos = n - 1; pos >= 0; pos--) {
      let c = line[pos] !== FILLED ? count[pos + 1][blk] : 0;
      if (canPlace(pos, len)) {
        const afterGap = pos + len === n ? n : pos + len + 1;
        c += count[afterGap][blk + 1];
      }
      count[pos][blk] = Math.min(c, TOTAL_CAP);
    }
  }

  // DFS po stanach (pos, blk) z przycinaniem przez canComplete. Preferencja
  // "połóż blok" daje porządek leksykograficzny od lewej; preferencja "zostaw
  // puste" sprawia, że pierwszy wynik to ułożenie najbardziej prawe.
  const collect = (max: number, placeFirst: boolean): number[][] => {
    const results: number[][] = [];
    const starts: number[] = [];
    const dfs = (pos: number, blk: number): boolean => {
      if (blk === k) {
        results.push([...starts]);
        return results.length >= max;
      }
      const len = clue[blk];
      const tryPlace = (): boolean => {
        if (!canPlace(pos, len)) return false;
        const afterGap = pos + len === n ? n : pos + len + 1;
        if (!canComplete[afterGap][blk + 1]) return false;
        starts.push(pos);
        const full = dfs(afterGap, blk + 1);
        starts.pop();
        return full;
      };
      const trySkip = (): boolean =>
        line[pos] !== FILLED && canComplete[pos + 1][blk] && dfs(pos + 1, blk);
      return placeFirst ? tryPlace() || trySkip() : trySkip() || tryPlace();
    };
    dfs(0, 0);
    return results;
  };

  const total = count[0][0];
  if (total <= limit || limit < 2) {
    return { placements: collect(Math.min(total, Math.max(1, limit)), true), total };
  }
  const leftmost = collect(limit - 1, true);
  const rightmost = collect(1, false);
  return { placements: [...leftmost, ...rightmost], total };
}
