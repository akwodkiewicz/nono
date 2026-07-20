# Tryb pomocnika — plan techniczny (do realizacji)

Status: **zaplanowany, nierozpoczęty**. Decyzja o podejściu podjęta — wariant
„edycja planszy + podpowiedź". Ten dokument utrwala kontekst projektowy, żeby
kolejna iteracja nie zaczynała od zera.

## Problem

Użytkownik rozwiązuje zagadkę **na papierze** i chce podpowiedzi „na którą
linię teraz patrzeć" — ale bez zdradzania samego wniosku. Sedno trudności:
aplikacja nie zna stanu kartki użytkownika, a sensowna podpowiedź zależy od
tego stanu (inne linie są „owocne" na początku, inne w połowie rozwiązywania).

## Wybrane podejście: edycja planszy + podpowiedź

Użytkownik przenosi stan z kartki, tapiąc komórki na planszy (cykl:
nieznana → zamalowana → krzyżyk → nieznana), a aplikacja szuka linii dającej
pewne wnioski **z tego stanu**. Odrzucony wariant minimalny („dwustopniowe
odsłanianie kroku" — podpowiedź linii tylko dla stanu, w którym jest solver
apki) nie wymagałby edycji planszy, ale działa wyłącznie gdy użytkownik idzie
z apką krok w krok.

## Projekt

### Silnik (`src/solver/`)

- **`Solver` ze stanem początkowym**: konstruktor przyjmuje opcjonalny
  `initialGrid` (`new Solver(puzzle, initialGrid?)`) zamiast zawsze budować
  pustą planszę (`solver.ts`, konstruktor). Kolejka startowa bez zmian —
  wszystkie linie.
- **Podpowiedź linii**: dla stanu użytkownika uruchomić `solveLine` na każdej
  linii i zebrać te z niepustym zbiorem dedukcji. Heurystyka wyboru jednej do
  wskazania — do rozstrzygnięcia przy implementacji (najprościej: najwięcej
  dedukcji; alternatywa: najmniejsza liczba legalnych ułożeń wg
  `enumeratePlacements`/`count`, czyli linia „najbardziej wymuszona", zwykle
  najłatwiejsza do zobaczenia na papierze).
- **Walidacja stanu wejściowego**: `solveLine === null` na dowolnej linii
  oznacza błąd przepisania z kartki (albo wcześniejszy błąd użytkownika na
  papierze) — komunikat musi wskazywać konkretną linię, analogicznie do
  obecnej obsługi sprzeczności.
- **Uwaga o inwariancie historii**: kroki solvera (`SolveStep`) zakładają
  dedukcje od pustej planszy — `gridAfterSteps` odtwarza stan wyłącznie
  z diffów (`history.ts`). Ręczne edycje łamią ten inwariant, więc tryb
  pomocnika **nie używa** historii kroków ani instancji `solver` ze store'u;
  trzyma własny grid.

### Store (`src/state/store.ts`)

- Nowy stan: `assistantGrid: Grid` (edytowany przez użytkownika),
  `hint: { line: LineRef; deductions: Deduction[] } | null`.
- Akcje: `cycleAssistantCell(row, col)`, `requestHint()` (liczy linię i chowa
  dedukcje), `revealHint()` (odsłania komórki i nanosi je na `assistantGrid`),
  `clearAssistant()`, wejście/wyjście z trybu.
- **Tryby interakcji planszy**: obecnie `Board` rozróżnia tap-strefy
  (krokowanie) i tryb sprawdzania (`checkMode`). Z pomocnikiem robią się trzy
  tryby — zamiast kolejnego booleana wprowadzić jawny
  `boardMode: 'step' | 'check' | 'edit'` i na nim oprzeć obsługę tapnięć
  w `Board.tsx` (dziś: `handleTap`).
- **Persistencja**: `assistantGrid` dopisać do `partialize` — stan
  przepisany z kartki jest kosztowny do odtworzenia, tak jak wskazówki.

### UI

- Wejście z widoku solvera (przycisk „Pomocnik" w `SolverControls`) albo
  osobny `view: 'assistant'` — do decyzji; osobny widok jest czystszy, bo
  historia kroków i tap-strefy nie mają tu zastosowania.
- Plansza: reużyć `Board` z trybem `edit` (tap cykluje stan komórki);
  wyróżnienie linii z podpowiedzi tak jak dziś wyróżniana jest linia
  ostatniego kroku (bursztyn).
- Podpowiedź dwustopniowa: najpierw sam adres linii („spójrz na kolumnę 12
  [5 2]"), po drugim tapnięciu odsłonięcie komórek + wizualizacja „dlaczego"
  — reużyć `StepExplanation`/`enumeratePlacements` (komponent `Explanation`
  przyjmuje `step` i `lineBefore`, więc wystarczy zbudować sztuczny
  `SolveStep` z wyliczonych dedukcji).
- Sprawdzanie pojedynczego pola (`checkMode`) działa też w pomocniku bez
  zmian — ukryte pełne rozwiązanie nie zależy od stanu użytkownika.

### Przypadki brzegowe

- Stan użytkownika sprzeczny ze wskazówkami → komunikat z linią, bez podpowiedzi.
- Żadna linia nie daje dedukcji (zagadka wymaga zgadywania z tego stanu) →
  komunikat jak dzisiejszy status `stuck`.
- Stan użytkownika kompletny → informacja „rozwiązane".

## Kolejność implementacji

1. `Solver` z `initialGrid` + testy (start z częściowego stanu, sprzeczny stan).
2. Moduł podpowiedzi (wybór linii + testy heurystyki).
3. `boardMode` w store i refaktor obsługi tapnięć w `Board`.
4. Widok pomocnika: edycja planszy, dwustopniowa podpowiedź, persistencja.
5. Dopisek w README (F-wymagania + instrukcja użycia).
