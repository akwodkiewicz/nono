# nono — solver nonogramów

Aplikacja webowa do rozwiązywania nonogramów (zagadek typu *paint-by-numbers*). Dwie kluczowe funkcje:

1. **Wczytywanie zagadki ze zdjęć** — zamiast żmudnego przepisywania definicji liczba po liczbie, robisz dwa zdjęcia wskazówek (wierszy i kolumn), a aplikacja odczytuje je automatycznie (OCR) i pozwala ręcznie poprawić błędy.
2. **Solver krok po kroku** — automatyczne rozwiązywanie naśladujące sposób pracy człowieka: wyłącznie dedukcje w 100% pewne, bez stawiania hipotez i zgadywania.

Całość działa **w przeglądarce, bez backendu** — zdjęcia i dane zagadki nie opuszczają urządzenia.

---

## Wymagania funkcjonalne

### F1. Wczytywanie zagadki ze zdjęć

| ID | Wymaganie |
|------|-----------|
| F1.1 | Wczytywanie odbywa się z **dwóch osobnych zdjęć**: wskazówek wierszy (orientacja *portrait*) oraz wskazówek kolumn (orientacja *landscape*) — trudno objąć całą zagadkę jednym kadrem w czytelnej rozdzielczości. |
| F1.2 | Preprocessing obrazu przed OCR: korekcja perspektywy, binaryzacja, wykrycie linii siatki i segmentacja obszaru wskazówek na pojedyncze komórki. |
| F1.3 | OCR cyfr wykonywany per komórka (whitelist znaków `0-9`), a nie na całym zdjęciu — znacząco podnosi skuteczność. |
| F1.4 | Ekran weryfikacji odczytu: podgląd rozpoznanych liczb zestawiony ze zdjęciem, z poziomem pewności OCR i podświetleniem komórek niepewnych. |
| F1.5 | **Manualna edycja** wczytanych wskazówek: poprawa pojedynczej liczby, dodanie/usunięcie liczby w wierszu lub kolumnie, zmiana wymiarów planszy. |
| F1.6 | Walidacja spójności danych przed uruchomieniem solvera: suma wskazówek wierszy = suma wskazówek kolumn; każda linia mieści się w wymiarach planszy (bloki + minimalne przerwy). |
| F1.7 | Możliwość wpisania zagadki całkowicie ręcznie, z pominięciem zdjęć. |

### F2. Solver krok po kroku

| ID | Wymaganie |
|------|-----------|
| F2.1 | Solver stosuje **wyłącznie dedukcje pewne** — zero hipotez o głębokości 1 lub większej, zero backtrackingu, zero „spróbujmy i zobaczmy, czy dojdzie do sprzeczności". Każda oznaczona komórka wynika logicznie z aktualnego stanu. |
| F2.2 | Silnik *line-solving*: dla analizowanej linii (wiersza/kolumny) wyznaczane jest przecięcie **wszystkich** legalnych ułożeń bloków zgodnych z bieżącym stanem linii; komórki o tej samej wartości we wszystkich ułożeniach są oznaczane jako pewne (wypełnione lub puste). |
| F2.3 | Propagacja wiersz ↔ kolumna do punktu stałego: dedukcja w linii kolejkuje do ponownej analizy linie prostopadłe, aż do wyczerpania wniosków. |
| F2.4 | **Tryb krokowy**: przycisk „następny krok" wykonuje jedną dedukcję i pokazuje, która linia została przeanalizowana, które komórki wywnioskowano i dlaczego. |
| F2.5 | **Tryb automatyczny**: rozwiązywanie do końca (lub do zatrzymania) z animacją kolejnych kroków. |
| F2.6 | Historia kroków z możliwością cofania. |
| F2.7 | Wykrywanie sprzeczności (efekt błędnych danych wejściowych) z komunikatem wskazującym problematyczną linię — pomocne przy korekcie błędów OCR. |
| F2.8 | Gdy zagadka wymaga zgadywania (logika liniowa nie wystarcza), solver zatrzymuje się i jasno to komunikuje, pozostawiając częściowe rozwiązanie na planszy. |

### F3. Interfejs planszy

| ID | Wymaganie |
|------|-----------|
| F3.1 | Renderowanie planszy wraz ze wskazówkami, skalujące się do dużych zagadek (np. 50×50): zoom, przewijanie, pogrubione linie co 5 komórek. |
| F3.2 | Wyróżnienie komórek wydedukowanych w ostatnim kroku oraz aktualnie analizowanej linii. |
| F3.3 | Responsywność i wygodna obsługa na telefonie — to nim zwykle robione są zdjęcia zagadki. |

## Wymagania niefunkcjonalne

| ID | Wymaganie |
|----|-----------|
| N1 | Aplikacja w pełni kliencka (statyczna) — bez backendu; zdjęcia i dane nie opuszczają przeglądarki. |
| N2 | OCR i solver działają w **Web Workerach**, żeby nie blokować interfejsu. |
| N3 | Hosting statyczny (GitHub Pages) z automatycznym deployem przez GitHub Actions. |
| N4 | Zapis bieżącej sesji w `localStorage`; eksport/import zagadki jako JSON. |
| N5 | Silnik solvera jako czysty moduł TypeScript, niezależny od UI, pokryty testami jednostkowymi. |

## Proponowany stack

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Język | **TypeScript** | Typowanie kluczowe dla logiki solvera i modelu danych zagadki. |
| UI | **React + Vite** | Popularny, dojrzały ekosystem; Vite daje szybki dev-server i prosty build statyczny. |
| Styling | **Tailwind CSS** | Szybkie iterowanie nad UI bez utrzymywania osobnych arkuszy stylów. |
| Stan aplikacji | **Zustand** | Lekki store bez boilerplate'u; wystarczający przy jednym głównym modelu danych. |
| OCR | **Tesseract.js** (WASM) | OCR w całości w przeglądarce — darmowy, offline, bez wysyłania zdjęć na serwer. Tryb pojedynczego znaku + whitelist `0-9`. |
| Preprocessing obrazu | **OpenCV.js** (WASM) + Canvas API | Korekcja perspektywy, progowanie adaptacyjne, wykrywanie siatki i segmentacja komórek — warunek dobrej skuteczności Tesseracta na zdjęciach z telefonu. |
| Współbieżność | **Web Workers** | OCR i solver poza wątkiem UI. |
| Testy | **Vitest** | Naturalny wybór przy Vite; szybkie testy jednostkowe solvera i parserów. |
| Jakość kodu | **ESLint + Prettier** | Standardowa higiena projektu. |
| CI/CD + hosting | **GitHub Actions → GitHub Pages** | Darmowy hosting aplikacji statycznej z automatycznym deployem po pushu. |

## Proponowana struktura katalogów

```
src/
  solver/       # czysta logika: model planszy, line-solver, propagacja, historia kroków
  ocr/          # pipeline obrazu: preprocessing (OpenCV.js), segmentacja, Tesseract.js
  workers/      # wrappery Web Workerów dla solvera i OCR
  state/        # store Zustand: zagadka, stan planszy, historia
  components/   # komponenty React: plansza, edytor wskazówek, ekran wczytywania zdjęć
```

## Etapy rozwoju

1. **Rdzeń solvera** — model danych zagadki, silnik line-solving, propagacja, wykrywanie sprzeczności; komplet testów jednostkowych.
2. **UI planszy i ręczna edycja** — renderowanie planszy, edytor wskazówek, walidacja; aplikacja w pełni użyteczna jeszcze bez OCR.
3. **Wczytywanie ze zdjęć** — pipeline preprocessingu i OCR, ekran weryfikacji i korekty odczytu.
4. **Szlif** — tryb krokowy z historią i uzasadnieniami, tryb automatyczny z animacją, zapis sesji, deploy na GitHub Pages.
