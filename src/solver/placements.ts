import { buildLineDp, normalizeClue } from './line';
import { EMPTY, FILLED, UNKNOWN, type Cell } from './types';

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

/** Cell array of a single placement: block cells FILLED, everything else EMPTY. */
export function placementCells(
  n: number,
  clue: readonly number[],
  starts: readonly number[],
): Cell[] {
  const cells = Array<Cell>(n).fill(EMPTY);
  starts.forEach((start, i) => {
    for (let j = start; j < start + clue[i]; j++) cells[j] = FILLED;
  });
  return cells;
}

export interface ExplanatoryPlacements {
  /** Wskazówka po normalizacji (bez zer) — pasuje do indeksów w `placements`. */
  clue: number[];
  /** Ułożenia (pozycje startowe bloków) posortowane od lewej do prawej. */
  placements: number[][];
  /** Liczba wszystkich legalnych ułożeń, nasycona na TOTAL_CAP. */
  total: number;
}

/**
 * Górna granica liczby ułożeń, które enumerujemy w poszukiwaniu pośrednich.
 * Powyżej niej linia ma tyle swobody, że jej dedukcje to zwykłe „overlapy"
 * pojedynczego bloku — w pełni widoczne już na dwóch skrajnych ułożeniach.
 */
const EXPLANATORY_POOL = 60;
/** Maksymalna liczba pokazywanych ułożeń (skrajne + kilka pośrednich). */
const EXPLANATORY_MAX = 6;

/**
 * Dobór ułożeń do wizualizacji „dlaczego ten krok" tak, by były **rzetelne**:
 * komórki o tej samej wartości we wszystkich POKAZANYCH ułożeniach pokrywają
 * się z komórkami o tej samej wartości we WSZYSTKICH legalnych ułożeniach
 * (czyli dokładnie z dedukcjami kroku, wśród komórek nieznanych w stanie przed).
 *
 * Zawsze zawiera skrajnie lewe i skrajnie prawe ułożenie. Gdy same skrajne nie
 * wystarczają (linie wieloblokowe: komórka wychodzi stała na skrajnych, choć w
 * rzeczywistości jest zmienna), dokłada minimalny zestaw ułożeń pośrednich —
 * greedy pokrycie zbioru — aż każda taka komórka zostanie „złamana", do limitu
 * `EXPLANATORY_MAX`.
 *
 * Zwraca null przy sprzeczności (jak `enumeratePlacements`).
 */
export function enumerateExplanatory(
  line: readonly Cell[],
  clueRaw: readonly number[],
): ExplanatoryPlacements | null {
  const enu = enumeratePlacements(line, clueRaw, EXPLANATORY_POOL);
  if (!enu) return null;
  const clue = normalizeClue(clueRaw);
  const { placements: pool, total } = enu;
  const n = line.length;

  if (total <= 1) return { clue, placements: [pool[0]], total };

  const leftmost = 0;
  const rightmost = pool.length - 1;

  // Powyżej progu `pool` to tylko skrajne lewe + skrajne prawe (enumeracja
  // obcięta) — bez pełnego zbioru nie da się dobrać pośrednich, więc pokazujemy
  // same skrajne. Przy takiej swobodzie dedukcje i tak są prostymi overlapami.
  if (total > EXPLANATORY_POOL) {
    return { clue, placements: [pool[leftmost], pool[rightmost]], total };
  }

  // `pool` zawiera teraz WSZYSTKIE ułożenia w porządku od lewej do prawej.
  const cells = pool.map((starts) => placementCells(n, clue, starts));

  // Uniwersum do „złamania": komórki nieznane w stanie przed, które są zmienne
  // wśród wszystkich ułożeń, ale na dwóch skrajnych wychodzą stałe.
  const chosen = new Set<number>([leftmost, rightmost]);
  let remaining: number[] = [];
  for (let p = 0; p < n; p++) {
    if (line[p] !== UNKNOWN) continue;
    let sawFilled = false;
    let sawEmpty = false;
    for (const c of cells) {
      if (c[p] === FILLED) sawFilled = true;
      else sawEmpty = true;
    }
    const varies = sawFilled && sawEmpty;
    if (varies && cells[leftmost][p] === cells[rightmost][p]) remaining.push(p);
  }

  // Greedy: dokładaj ułożenie łamiące najwięcej pozostałych komórek. Każda
  // komórka w `remaining` jest stała wśród `chosen`, więc jej wartość bierzemy
  // z dowolnego wybranego ułożenia; kandydat ją łamie, gdy ma inną wartość.
  const anyChosen = () => cells[chosen.values().next().value as number];
  while (remaining.length > 0 && chosen.size < EXPLANATORY_MAX) {
    let best = -1;
    let bestCover: number[] = [];
    for (let i = 0; i < pool.length; i++) {
      if (chosen.has(i)) continue;
      const cover = remaining.filter((p) => cells[i][p] !== anyChosen()[p]);
      if (cover.length > bestCover.length) {
        best = i;
        bestCover = cover;
      }
    }
    if (best < 0 || bestCover.length === 0) break;
    chosen.add(best);
    const covered = new Set(bestCover);
    remaining = remaining.filter((p) => !covered.has(p));
  }

  const placements = [...chosen].sort((a, b) => a - b).map((i) => pool[i]);
  return { clue, placements, total };
}
