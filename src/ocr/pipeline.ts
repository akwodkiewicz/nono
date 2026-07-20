import { bitmapToCanvas, loadImageData } from './browser';
import { adaptiveBinarize, cropBitmap, grayscale } from './raster';
import { recognizeDigits } from './recognize';
import { prepareCluePhoto, segmentCluePhoto, type Orientation } from './segment';

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

/**
 * Pełny pipeline odczytu wskazówek ze zdjęcia:
 * zdjęcie → skala szarości → binaryzacja adaptacyjna → przycięcie do obszaru
 * wskazówek (po ramce siatki) i czyszczenie ze wszystkiego, co nie wygląda
 * jak cyfra → segmentacja na linie i tokeny → OCR każdego tokenu osobno.
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
  const gray = grayscale(image);
  const radius = Math.round(Math.max(image.width, image.height) / 32);
  const bin = adaptiveBinarize(gray, image.width, image.height, radius);
  const bmp = prepareCluePhoto(bin, orientation, gray);

  const lines = segmentCluePhoto(bmp, orientation);
  const total = lines.reduce((sum, tokens) => sum + tokens.length, 0);
  onProgress?.(0, total);

  let done = 0;
  const result: OcrLine[] = [];
  for (const boxes of lines) {
    const tokens: OcrToken[] = [];
    for (const box of boxes) {
      const crop = cropBitmap(bmp, box.x, box.y, box.w, box.h);
      const canvas = bitmapToCanvas(crop);
      const { value, confidence } = await recognizeDigits(canvas);
      tokens.push({ value, confidence, crop: canvas.toDataURL('image/png') });
      done++;
      onProgress?.(done, total);
    }
    result.push({ tokens });
  }
  return result;
}
