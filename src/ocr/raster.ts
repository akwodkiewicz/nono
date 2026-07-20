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

/**
 * Zmniejsza obraz RGBA do maxDim (próbkowanie uśredniające). W przeglądarce
 * robi to canvas; ta czysta wersja służy testom w Node na prawdziwych
 * zdjęciach, żeby przechodziły przez identyczną resztę pipeline'u.
 */
export function downscaleRgba(image: RgbaImage, maxDim: number): RgbaImage {
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y / scale);
    const sy1 = Math.min(image.height, Math.max(sy0 + 1, Math.floor((y + 1) / scale)));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / scale);
      const sx1 = Math.min(image.width, Math.max(sx0 + 1, Math.floor((x + 1) / scale)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const o = (sy * image.width + sx) * 4;
          r += image.data[o];
          g += image.data[o + 1];
          b += image.data[o + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
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

/**
 * Binaryzacja adaptacyjna: piksel jest atramentem, gdy jest wyraźnie
 * ciemniejszy od średniej swojego otoczenia (okno 2r×2r przez obraz
 * całkowy). W przeciwieństwie do globalnego Otsu radzi sobie z nierównym
 * oświetleniem i z tłem wokół kartki (jednolite ciemniejsze tło nie jest
 * "ciemniejsze od swojego otoczenia", więc nie staje się atramentem).
 */
export function adaptiveBinarize(
  gray: Uint8Array,
  width: number,
  height: number,
  radius: number,
  k = 0.15,
): Bitmap {
  const iw = width + 1;
  const integral = new Float64Array(iw * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }

  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum =
        integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      const mean = sum / area;
      data[y * width + x] = gray[y * width + x] < mean * (1 - k) ? 1 : 0;
    }
  }
  return { data, width, height };
}

export interface CleanupOptions {
  /** Mniejsze skupiska pikseli to szum. */
  minArea?: number;
  /** Największy dopuszczalny rozmiar glifu (px) — dłuższe twory to linie/krawędzie. */
  maxGlyphSize?: number;
  /**
   * Obraz w skali szarości. Gdy podany, ze zbyt dużych składowych odzyskiwane
   * są fragmenty ciemne jak druk: cyfra sklejona ze śladem ołówka lub linią
   * przetrwa, bo druk jest wyraźnie ciemniejszy od ołówka.
   */
  gray?: Uint8Array;
}

interface Component {
  pixels: number[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function floodFill(
  data: Uint8Array,
  visited: Uint8Array,
  stack: Int32Array,
  width: number,
  height: number,
  start: number,
): Component {
  let top = 0;
  stack[top++] = start;
  visited[start] = 1;
  const pixels: number[] = [];
  let x0 = width;
  let x1 = -1;
  let y0 = height;
  let y1 = -1;
  while (top > 0) {
    const idx = stack[--top];
    pixels.push(idx);
    const x = idx % width;
    const y = (idx - x) / width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (x > 0 && data[idx - 1] && !visited[idx - 1]) {
      visited[idx - 1] = 1;
      stack[top++] = idx - 1;
    }
    if (x < width - 1 && data[idx + 1] && !visited[idx + 1]) {
      visited[idx + 1] = 1;
      stack[top++] = idx + 1;
    }
    if (y > 0 && data[idx - width] && !visited[idx - width]) {
      visited[idx - width] = 1;
      stack[top++] = idx - width;
    }
    if (y < height - 1 && data[idx + width] && !visited[idx + width]) {
      visited[idx + width] = 1;
      stack[top++] = idx + width;
    }
  }
  return { pixels, x0, y0, x1, y1 };
}

/**
 * Czyszczenie przez spójne składowe: zostają tylko twory wielkości cyfr.
 * Usuwa linie siatki/separatorów (długi bounding box — działa też przy
 * obróconym lub wygiętym zdjęciu, gdzie kasowanie całych wierszy pikseli
 * zawodzi), krawędzie kartki, plamy tła i drobny szum.
 */
export function keepDigitLikeComponents(bmp: Bitmap, options: CleanupOptions = {}): Bitmap {
  const { width, height } = bmp;
  const minArea = options.minArea ?? 8;
  const maxGlyph = options.maxGlyphSize ?? Math.max(24, Math.round(Math.min(width, height) * 0.12));
  const { gray } = options;

  const data = new Uint8Array(bmp.data);
  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let darkData: Uint8Array | null = null;
  let darkVisited: Uint8Array | null = null;

  const isDigitLike = (c: Component): boolean => {
    const w = c.x1 - c.x0 + 1;
    const h = c.y1 - c.y0 + 1;
    if (c.pixels.length < minArea) return false;
    if (w > maxGlyph || h > maxGlyph) return false;
    // Cienkie i wydłużone twory tuż pod progiem wielkości to zwykle
    // fragmenty przerywanych linii separatorów.
    if ((w > 3 * h && w > 0.7 * maxGlyph) || (h > 3 * w && h > 0.7 * maxGlyph)) return false;
    // Żadna cyfra (nawet "1") nie jest tak wydłużona — to zawsze kawałek
    // linii, niezależnie od bezwzględnego rozmiaru.
    if (w > 6 * h || h > 6 * w) return false;
    return true;
  };

  // Próg "ciemności druku" (Otsu po pikselach atramentu) liczony leniwie —
  // potrzebny tylko, gdy trafi się zbyt duża składowa do odzyskania.
  let printThreshold: number | null = null;
  const getPrintThreshold = (): number => {
    if (printThreshold === null) {
      const inkGrays: number[] = [];
      for (let i = 0; i < bmp.data.length; i++) {
        if (bmp.data[i]) inkGrays.push(gray![i]);
      }
      printThreshold = otsuThreshold(Uint8Array.from(inkGrays));
    }
    return printThreshold;
  };

  for (let start = 0; start < data.length; start++) {
    if (!data[start] || visited[start]) continue;
    const component = floodFill(data, visited, stack, width, height, start);
    if (isDigitLike(component)) continue;

    for (const idx of component.pixels) data[idx] = 0;

    const w = component.x1 - component.x0 + 1;
    const h = component.y1 - component.y0 + 1;
    const tooBig = w > maxGlyph || h > maxGlyph;
    // Odzyskujemy tylko z tworów grubych w obu wymiarach (kleks ołówka
    // sklejony z cyframi). Linie separatorów są cienkie — ich ciemne
    // fragmenty wskrzeszałyby się jako fałszywe "cyfry".
    const blobLike = Math.min(w, h) > maxGlyph * 0.5;
    if (!tooBig || !blobLike || !gray || component.pixels.length < minArea) {
      continue;
    }

    // Odzysk: w usuniętej dużej składowej zostaw tylko piksele ciemne jak
    // druk i przywróć te fragmenty, które same w sobie wyglądają jak cyfry.
    const threshold = getPrintThreshold();
    darkData ??= new Uint8Array(width * height);
    darkVisited ??= new Uint8Array(width * height);
    let darkCount = 0;
    for (const idx of component.pixels) {
      if (gray[idx] <= threshold) {
        darkData[idx] = 1;
        darkCount++;
      }
    }
    if (darkCount >= minArea && darkCount < component.pixels.length) {
      for (const idx of component.pixels) {
        if (!darkData[idx] || darkVisited[idx]) continue;
        const sub = floodFill(darkData, darkVisited, stack, width, height, idx);
        if (isDigitLike(sub)) {
          for (const subIdx of sub.pixels) data[subIdx] = 1;
        }
      }
    }
    // Wyczyść bufory robocze tylko w obrębie tej składowej.
    for (const idx of component.pixels) {
      darkData[idx] = 0;
      darkVisited[idx] = 0;
    }
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
export function maxRunInRow(bmp: Bitmap, y: number): number {
  let max = 0;
  let run = 0;
  const off = y * bmp.width;
  for (let x = 0; x < bmp.width; x++) {
    run = bmp.data[off + x] ? run + 1 : 0;
    if (run > max) max = run;
  }
  return max;
}

export function maxRunInCol(bmp: Bitmap, x: number): number {
  let max = 0;
  let run = 0;
  for (let y = 0; y < bmp.height; y++) {
    run = bmp.data[y * bmp.width + x] ? run + 1 : 0;
    if (run > max) max = run;
  }
  return max;
}

export function removeGridLines(bmp: Bitmap, coverage = 0.5): Bitmap {
  const data = new Uint8Array(bmp.data);
  const { width, height } = bmp;
  for (let y = 0; y < height; y++) {
    if (maxRunInRow(bmp, y) >= width * coverage) data.fill(0, y * width, (y + 1) * width);
  }
  for (let x = 0; x < width; x++) {
    if (maxRunInCol(bmp, x) >= height * coverage) {
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
