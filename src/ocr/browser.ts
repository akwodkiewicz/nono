import type { Bitmap, RgbaImage } from './raster';

/**
 * Wczytuje zdjęcie do ImageData, skalując w dół do maxDim — zdjęcia
 * z telefonu mają 12+ Mpx, a segmentacji i OCR wystarcza ~2600 px,
 * za to działa wielokrotnie szybciej. Mniejsze wymiary psują segmentację:
 * odstępy między sąsiednimi liczbami robią się mniejsze niż odstępy między
 * cyframi jednej liczby po przeskalowaniu.
 */
export async function loadImageData(file: File, maxDim = 2600): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Rysuje wycinek OBRAZU W SKALI SZAROŚCI z normalizacją kontrastu
 * (najciemniejszy piksel → czerń, najjaśniejszy → biel), przeskalowany do
 * targetHeight z białym marginesem. LSTM Tesseracta czyta wygładzone glify
 * wyraźnie lepiej niż twardą binaryzację — na niej tracił pojedyncze cyfry.
 */
export function grayTokenCanvas(
  gray: Uint8Array,
  imgWidth: number,
  box: { x: number; y: number; w: number; h: number },
  targetHeight = 48,
  margin = 8,
): HTMLCanvasElement {
  let min = 255;
  let max = 0;
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const v = gray[(box.y + y) * imgWidth + (box.x + x)];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = Math.max(1, max - min);

  const raw = document.createElement('canvas');
  raw.width = box.w;
  raw.height = box.h;
  const rawCtx = raw.getContext('2d')!;
  const imageData = rawCtx.createImageData(box.w, box.h);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const v = Math.round(((gray[(box.y + y) * imgWidth + (box.x + x)] - min) / range) * 255);
      const o = (y * box.w + x) * 4;
      imageData.data[o] = v;
      imageData.data[o + 1] = v;
      imageData.data[o + 2] = v;
      imageData.data[o + 3] = 255;
    }
  }
  rawCtx.putImageData(imageData, 0, 0);

  const scale = targetHeight / box.h;
  const w = Math.max(1, Math.round(box.w * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w + margin * 2;
  canvas.height = targetHeight + margin * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(raw, margin, margin, w, targetHeight);
  return canvas;
}

/**
 * Rysuje wycinek binarny jako czarne cyfry na białym tle — zapasowa ścieżka,
 * gdy obraz w skali szarości nie jest dostępny.
 */
export function bitmapToCanvas(bmp: Bitmap, targetHeight = 48, margin = 8): HTMLCanvasElement {
  const scale = targetHeight / bmp.height;
  const w = Math.max(1, Math.round(bmp.width * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w + margin * 2;
  canvas.height = targetHeight + margin * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const raw = document.createElement('canvas');
  raw.width = bmp.width;
  raw.height = bmp.height;
  const rawCtx = raw.getContext('2d')!;
  const imageData = rawCtx.createImageData(bmp.width, bmp.height);
  for (let i = 0; i < bmp.data.length; i++) {
    const v = bmp.data[i] ? 0 : 255;
    const o = i * 4;
    imageData.data[o] = v;
    imageData.data[o + 1] = v;
    imageData.data[o + 2] = v;
    imageData.data[o + 3] = 255;
  }
  rawCtx.putImageData(imageData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(raw, margin, margin, w, targetHeight);
  return canvas;
}
