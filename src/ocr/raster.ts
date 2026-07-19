/**
 * Czyste operacje na pikselach — bez DOM/canvas, żeby dały się testować
 * jednostkowo w Node. Część przeglądarkowa (wczytanie zdjęcia, canvas dla
 * Tesseracta) jest w browser.ts.
 */

/** Obraz binarny: 1 = atrament (ciemny piksel), 0 = tło. */
export interface Bitmap {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Minimalny kształt ImageData — bez zależności od typów DOM. */
export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Luminancja 0-255 (Rec. 601). */
export function grayscale(image: RgbaImage): Uint8Array {
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
  }
  return gray;
}

/** Globalny próg metodą Otsu — maksymalizacja wariancji międzyklasowej. */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;

  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];

  let sumBg = 0;
  let weightBg = 0;
  let bestVariance = -1;
  let bestThreshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t];
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;
    sumBg += t * hist[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const variance = weightBg * weightFg * (meanBg - meanFg) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = t;
    }
  }
  return bestThreshold;
}

/** Binaryzacja: atramentem jest wszystko ciemniejsze od progu. */
export function binarize(gray: Uint8Array, width: number, height: number, threshold: number): Bitmap {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    data[i] = gray[i] <= threshold ? 1 : 0;
  }
  return { data, width, height };
}

/** Liczba pikseli atramentu w każdym wierszu obrazu. */
export function projectRows(bmp: Bitmap): number[] {
  const proj = new Array<number>(bmp.height).fill(0);
  for (let y = 0; y < bmp.height; y++) {
    let sum = 0;
    const off = y * bmp.width;
    for (let x = 0; x < bmp.width; x++) sum += bmp.data[off + x];
    proj[y] = sum;
  }
  return proj;
}

/** Liczba pikseli atramentu w każdej kolumnie obrazu. */
export function projectCols(bmp: Bitmap): number[] {
  const proj = new Array<number>(bmp.width).fill(0);
  for (let y = 0; y < bmp.height; y++) {
    const off = y * bmp.width;
    for (let x = 0; x < bmp.width; x++) proj[x] += bmp.data[off + x];
  }
  return proj;
}

/**
 * Usuwa linie siatki: wiersze/kolumny z długim CIĄGŁYM odcinkiem atramentu
 * to niemal na pewno linie tabelki — kreski cyfr są krótkie i poprzerywane.
 * Kryterium ciągłości (a nie sumy pikseli) nie kasuje kolumn gęsto
 * zapisanych cyframi. Bez usunięcia linii projekcje nie mają przerw
 * i segmentacja się sypie.
 */
export function removeGridLines(bmp: Bitmap, coverage = 0.5): Bitmap {
  const data = new Uint8Array(bmp.data);
  const { width, height } = bmp;

  const maxRunInRow = (y: number): number => {
    let max = 0;
    let run = 0;
    const off = y * width;
    for (let x = 0; x < width; x++) {
      run = bmp.data[off + x] ? run + 1 : 0;
      if (run > max) max = run;
    }
    return max;
  };
  const maxRunInCol = (x: number): number => {
    let max = 0;
    let run = 0;
    for (let y = 0; y < height; y++) {
      run = bmp.data[y * width + x] ? run + 1 : 0;
      if (run > max) max = run;
    }
    return max;
  };

  for (let y = 0; y < height; y++) {
    if (maxRunInRow(y) >= width * coverage) data.fill(0, y * width, (y + 1) * width);
  }
  for (let x = 0; x < width; x++) {
    if (maxRunInCol(x) >= height * coverage) {
      for (let y = 0; y < height; y++) data[y * width + x] = 0;
    }
  }
  return { data, width, height };
}

export function cropBitmap(bmp: Bitmap, x: number, y: number, w: number, h: number): Bitmap {
  const data = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    const src = (y + row) * bmp.width + x;
    data.set(bmp.data.subarray(src, src + w), row * w);
  }
  return { data, width: w, height: h };
}
