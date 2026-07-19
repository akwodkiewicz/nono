import type { Bitmap, RgbaImage } from './raster';

/**
 * Wczytuje zdjęcie do ImageData, skalując w dół do maxDim — zdjęcia
 * z telefonu mają 12+ Mpx, a segmentacji i OCR wystarcza ~1600 px,
 * za to działa wielokrotnie szybciej.
 */
export async function loadImageData(file: File, maxDim = 1600): Promise<RgbaImage> {
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
 * Rysuje wycinek binarny jako czarne cyfry na białym tle, przeskalowany do
 * targetHeight z marginesem — w takiej postaci Tesseract radzi sobie
 * najlepiej.
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
