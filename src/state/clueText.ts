/**
 * Parsuje tekst wskazówki jednej linii ("3 1 2" → [3, 1, 2]).
 * Separatorem są spacje, przecinki, kropki i myślniki — kropka/przecinek są
 * dostępne na mobilnej klawiaturze numerycznej (inputMode="decimal"), więc
 * na telefonie da się rozdzielać liczby bez pełnej klawiatury.
 * Pusty tekst to pusta linia. Zwraca null, gdy tekst zawiera coś innego
 * niż liczby i separatory.
 */
export function parseClueText(text: string): number[] | null {
  const tokens = text
    .trim()
    .split(/[\s,.\-]+/)
    .filter((token) => token.length > 0);
  const clue: number[] = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) return null;
    clue.push(Number.parseInt(token, 10));
  }
  return clue;
}

export function formatClue(clue: readonly number[]): string {
  return clue.filter((block) => block > 0).join(' ');
}
