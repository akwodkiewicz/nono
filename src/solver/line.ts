import { EMPTY, FILLED, type Cell } from './types';

/** Usuwa zera ze wskazówki — [0] to konwencja zapisu pustej linii. */
export function normalizeClue(clue: readonly number[]): number[] {
  return clue.filter((block) => block > 0);
}

/**
 * Wspólne DP po sufiksach linii — fundament analizy linii (solveLine)
 * i jawnej enumeracji ułożeń (enumeratePlacements):
 *  - `canComplete[pos][blk]` — czy sufiks linii od `pos` da się dokończyć
 *    blokami od `blk`, zgodnie z już oznaczonymi komórkami,
 *  - `canPlace(pos, len)` — czy blok długości `len` może zaczynać się w `pos`:
 *    mieści się w linii, nie nachodzi na komórki EMPTY, a komórka tuż za nim
 *    (przerwa) nie jest FILLED.
 */
export interface LineDp {
  /** Wskazówka po normalizacji (bez zer). */
  clue: number[];
  canComplete: boolean[][];
  canPlace: (pos: number, len: number) => boolean;
}

export function buildLineDp(line: readonly Cell[], clueRaw: readonly number[]): LineDp {
  const clue = normalizeClue(clueRaw);
  const n = line.length;
  const k = clue.length;

  // Prefiksowe liczniki pustych komórek — canPlace w O(1).
  const emptyBefore = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    emptyBefore[i + 1] = emptyBefore[i] + (line[i] === EMPTY ? 1 : 0);
  }

  const canPlace = (pos: number, len: number): boolean => {
    if (pos + len > n) return false;
    if (emptyBefore[pos + len] - emptyBefore[pos] > 0) return false;
    if (pos + len < n && line[pos + len] === FILLED) return false;
    return true;
  };

  const canComplete: boolean[][] = Array.from({ length: n + 1 }, () =>
    new Array<boolean>(k + 1).fill(false),
  );
  canComplete[n][k] = true;
  for (let pos = n - 1; pos >= 0; pos--) {
    canComplete[pos][k] = line[pos] !== FILLED && canComplete[pos + 1][k];
  }
  for (let blk = k - 1; blk >= 0; blk--) {
    const len = clue[blk];
    for (let pos = n - 1; pos >= 0; pos--) {
      let ok = line[pos] !== FILLED && canComplete[pos + 1][blk];
      if (!ok && canPlace(pos, len)) {
        const afterGap = pos + len === n ? n : pos + len + 1;
        ok = canComplete[afterGap][blk + 1];
      }
      canComplete[pos][blk] = ok;
    }
  }

  return { clue, canComplete, canPlace };
}

/**
 * Analiza pojedynczej linii metodą przecięcia wszystkich legalnych ułożeń.
 *
 * Dla bieżącego stanu linii i wskazówki wyznacza, które komórki mają tę samą
 * wartość w KAŻDYM legalnym ułożeniu bloków — tylko takie komórki wolno
 * oznaczyć, bo tylko one są w 100% pewne (bez hipotez i zgadywania).
 *
 * Zamiast wyliczać ułożenia jawnie (wykładniczo dużo), używa DP z buildLineDp;
 * przejście "przód" po stanach osiągalnych z początku linii zaznacza, które
 * komórki mogą być wypełnione, a które puste w jakimkolwiek pełnym legalnym
 * ułożeniu.
 *
 * Zwraca `null`, gdy żadne ułożenie nie pasuje do bieżącego stanu
 * (sprzeczność). W przeciwnym razie zwraca nowy stan linii: komórki pewne
 * dostają FILLED/EMPTY, pozostałe zachowują dotychczasową wartość.
 */
export function solveLine(line: readonly Cell[], clueRaw: readonly number[]): Cell[] | null {
  const { clue, canComplete, canPlace } = buildLineDp(line, clueRaw);
  const n = line.length;
  const k = clue.length;

  if (!canComplete[0][0]) return null;

  // Przejście w przód: stan (pos, blk) jest osiągalny, jeśli prefiks linii
  // przed pos da się legalnie ułożyć blokami przed blk. Krawędź przejścia
  // należy do pełnego legalnego ułożenia ⟺ stan wyjściowy jest osiągalny,
  // a docelowy dokańczalny — wtedy zaznaczamy możliwe wartości komórek.
  const canBeFilled = new Array<boolean>(n).fill(false);
  const canBeEmpty = new Array<boolean>(n).fill(false);
  const reachable: boolean[][] = Array.from({ length: n + 1 }, () =>
    new Array<boolean>(k + 1).fill(false),
  );
  reachable[0][0] = true;

  for (let pos = 0; pos < n; pos++) {
    for (let blk = 0; blk <= k; blk++) {
      if (!reachable[pos][blk]) continue;

      // Przejście 1: komórka pos zostaje pusta.
      if (line[pos] !== FILLED && canComplete[pos + 1][blk]) {
        canBeEmpty[pos] = true;
        reachable[pos + 1][blk] = true;
      }

      // Przejście 2: blok blk zaczyna się w pos (wraz z przerwą za nim).
      if (blk < k) {
        const len = clue[blk];
        if (canPlace(pos, len)) {
          const afterGap = pos + len === n ? n : pos + len + 1;
          if (canComplete[afterGap][blk + 1]) {
            for (let i = pos; i < pos + len; i++) canBeFilled[i] = true;
            if (pos + len < n) canBeEmpty[pos + len] = true;
            reachable[afterGap][blk + 1] = true;
          }
        }
      }
    }
  }

  const result: Cell[] = new Array<Cell>(n);
  for (let i = 0; i < n; i++) {
    const filled = canBeFilled[i];
    const empty = canBeEmpty[i];
    if (filled && empty) {
      result[i] = line[i];
    } else if (filled) {
      result[i] = FILLED;
    } else if (empty) {
      result[i] = EMPTY;
    } else {
      return null;
    }
  }
  return result;
}
