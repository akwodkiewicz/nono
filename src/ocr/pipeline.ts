import { bitmapToCanvas, grayTokenCanvas, loadImageData } from './browser';
import { adaptiveBinarize, cropBitmap, grayscale, type Bitmap } from './raster';
import { recognizeDigits, type DigitsResult } from './recognize';
import {
  findSplitColumn,
  prepareCluePhoto,
  segmentCluePhoto,
  type Box,
  type Orientation,
} from './segment';

export type { Orientation } from './segment';

export interface OcrToken {
  value: number | null;
  confidence: number;
  /** Miniatura wycinka (data URL) do porównania z odczytem w UI. */
  crop: string;
}

export interface OcrLine {
  tokens: OcrToken[];
}

function tokenCanvas(box: Box, bmp: Bitmap, gray?: Uint8Array): HTMLCanvasElement {
  return gray
    ? grayTokenCanvas(gray, bmp.width, box)
    : bitmapToCanvas(cropBitmap(bmp, box.x, box.y, box.w, box.h));
}

function pickBetter(a: DigitsResult, b: DigitsResult): DigitsResult {
  if (a.value === null) return b;
  if (b.value === null) return a;
  if (a.value === b.value) {
    return { value: a.value, confidence: Math.max(a.confidence, b.confidence) };
  }
  // Dwa warianty wycinka dały różne odczyty — bierzemy pewniejszy, ale
  // z obniżoną pewnością, żeby UI oznaczyło token do ręcznego sprawdzenia.
  const winner = a.confidence >= b.confidence ? a : b;
  return { value: winner.value, confidence: Math.max(1, winner.confidence - 25) };
}

/**
 * Ensemble dwóch wariantów wycinka: wygładzonego (skala szarości
 * z normalizacją kontrastu) i twardej binaryzacji. Na realnych zdjęciach
 * mylą się na RÓŻNYCH tokenach (szczególnie cyfra 6), więc para odczytów
 * łapie większość błędów pojedynczego wariantu, a niezgodność jest cennym
 * sygnałem niepewności.
 */
async function recognizeBox(box: Box, bmp: Bitmap, gray?: Uint8Array): Promise<DigitsResult> {
  const binary = await recognizeDigits(bitmapToCanvas(cropBitmap(bmp, box.x, box.y, box.w, box.h)));
  if (!gray) return binary;
  const smooth = await recognizeDigits(grayTokenCanvas(gray, bmp.width, box));
  return pickBetter(smooth, binary);
}

/**
 * Rozpoznaje jeden token. Tokeny o proporcjach liczby dwucyfrowej, z których
 * OCR wyciągnął co najwyżej jedną cyfrę, są rozcinane w dolinie atramentu
 * i rozpoznawane po cyfrze — Tesseract potrafił czytać "11" jako "1".
 */
async function recognizeToken(box: Box, bmp: Bitmap, gray?: Uint8Array): Promise<DigitsResult> {
  const primary = await recognizeBox(box, bmp, gray);
  const looksTwoDigit = box.w > box.h * 0.9;
  if (!looksTwoDigit || (primary.value !== null && primary.value >= 10)) {
    return primary;
  }

  const split = findSplitColumn(cropBitmap(bmp, box.x, box.y, box.w, box.h));
  if (split === null) return primary;
  const leftBox: Box = { x: box.x, y: box.y, w: split, h: box.h };
  const rightBox: Box = { x: box.x + split, y: box.y, w: box.w - split, h: box.h };
  const left = await recognizeBox(leftBox, bmp, gray);
  const right = await recognizeBox(rightBox, bmp, gray);
  if (left.value === null || right.value === null) return primary;

  const combined: DigitsResult = {
    value: Number.parseInt(`${left.value}${right.value}`, 10),
    confidence: Math.min(left.confidence, right.confidence),
  };
  // Rozcięcie przyjmujemy, gdy całościowy odczyt zawiódł albo jest słabszy.
  if (primary.value === null || combined.confidence >= primary.confidence) {
    return combined;
  }
  return primary;
}

/**
 * Pełny pipeline odczytu wskazówek ze zdjęcia:
 * zdjęcie → skala szarości → binaryzacja adaptacyjna → przycięcie do obszaru
 * wskazówek (po ramce siatki) i czyszczenie ze wszystkiego, co nie wygląda
 * jak cyfra → segmentacja na linie i tokeny → OCR każdego tokenu osobno
 * (z wycinka w skali szarości z normalizacją kontrastu).
 *
 * Binaryzacja adaptacyjna zamiast globalnego Otsu, bo zdjęcia z telefonu
 * mają nierówne światło i tło wokół kartki. OCR per token (a nie na całym
 * zdjęciu) jest kluczowy: Tesseract z whitelistą cyfr na małym, czystym
 * wycinku myli się rzadko, a segmentacja i tak jest potrzebna, żeby
 * wiedzieć, które liczby należą do której linii.
 */
export async function readCluesFromPhoto(
  file: File,
  orientation: Orientation,
  onProgress?: (done: number, total: number) => void,
): Promise<OcrLine[]> {
  const image = await loadImageData(file);
  const fullGray = grayscale(image);
  const radius = Math.round(Math.max(image.width, image.height) / 32);
  const bin = adaptiveBinarize(fullGray, image.width, image.height, radius);
  const { bitmap, gray } = prepareCluePhoto(bin, orientation, fullGray);

  const lines = segmentCluePhoto(bitmap, orientation);
  const total = lines.reduce((sum, tokens) => sum + tokens.length, 0);
  onProgress?.(0, total);

  let done = 0;
  const result: OcrLine[] = [];
  for (const boxes of lines) {
    const tokens: OcrToken[] = [];
    for (const box of boxes) {
      const { value, confidence } = await recognizeToken(box, bitmap, gray);
      tokens.push({ value, confidence, crop: tokenCanvas(box, bitmap, gray).toDataURL('image/png') });
      done++;
      onProgress?.(done, total);
    }
    result.push({ tokens });
  }
  return result;
}
