import { cropBitmap, projectCols, projectRows, type Bitmap } from './raster';

export interface Span {
  start: number;
  end: number; // przedział [start, end)
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Orientation = 'rows' | 'cols';

/**
 * Znajduje pasma w projekcji atramentu: ciągi pozycji z atramentem powyżej
 * minInk, sklejane gdy dzieli je przerwa ≤ mergeGap, odfiltrowane z pasm
 * krótszych niż minSize (szum).
 */
export function findBands(
  projection: readonly number[],
  minInk: number,
  mergeGap: number,
  minSize: number,
): Span[] {
  const runs: Span[] = [];
  let start = -1;
  for (let i = 0; i < projection.length; i++) {
    if (projection[i] > minInk) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      runs.push({ start, end: i });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: projection.length });

  const merged: Span[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && run.start - prev.end <= mergeGap) {
      prev.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }
  return merged.filter((span) => span.end - span.start >= minSize);
}

/** Zacieśnia box do faktycznego atramentu w pionie (dla tokenu z pasma). */
function tightYBounds(bmp: Bitmap, box: Box): Box {
  let y0 = box.y + box.h;
  let y1 = box.y;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (bmp.data[y * bmp.width + x]) {
        if (y < y0) y0 = y;
        if (y >= y1) y1 = y + 1;
        break;
      }
    }
  }
  return y1 > y0 ? { x: box.x, y: y0, w: box.w, h: y1 - y0 } : box;
}

function tightXBounds(bmp: Bitmap, box: Box): Box {
  let x0 = box.x + box.w;
  let x1 = box.x;
  for (let x = box.x; x < box.x + box.w; x++) {
    for (let y = box.y; y < box.y + box.h; y++) {
      if (bmp.data[y * bmp.width + x]) {
        if (x < x0) x0 = x;
        if (x >= x1) x1 = x + 1;
        break;
      }
    }
  }
  return x1 > x0 ? { x: x0, y: box.y, w: x1 - x0, h: box.h } : box;
}

/**
 * Segmentacja zdjęcia wskazówek na tokeny (jedna liczba = jeden token).
 * Zwraca listę linii (wiersz/kolumna zagadki), każda z boxami tokenów
 * w kolejności czytania.
 *
 * 'rows'  — zdjęcie wskazówek WIERSZY: linie tekstu jedna pod drugą,
 *           w linii liczby obok siebie. Cyfry tej samej liczby stoją blisko
 *           siebie, osobne liczby dzieli większy odstęp — stąd sklejanie
 *           pasm w osi X progiem zależnym od wysokości linii.
 * 'cols'  — zdjęcie wskazówek KOLUMN: pionowe kolumny liczb; wewnątrz
 *           kolumny liczby jedna pod drugą (wielocyfrowe mają cyfry obok
 *           siebie, więc w osi Y nie trzeba nic sklejać poza szczelinami).
 */
export function segmentCluePhoto(bmp: Bitmap, orientation: Orientation): Box[][] {
  if (orientation === 'rows') {
    const noise = Math.max(1, Math.round(bmp.width * 0.003));
    const bands = findBands(projectRows(bmp), noise, 3, 4);
    return bands.map((band) => {
      const bandH = band.end - band.start;
      const sub = cropBitmap(bmp, 0, band.start, bmp.width, bandH);
      const digitGap = Math.max(2, Math.round(bandH * 0.35));
      const tokens = findBands(projectCols(sub), 0, digitGap, 2);
      return tokens.map((t) =>
        tightYBounds(bmp, { x: t.start, y: band.start, w: t.end - t.start, h: bandH }),
      );
    });
  }

  const noise = Math.max(1, Math.round(bmp.height * 0.003));
  const strips = findBands(projectCols(bmp), noise, 3, 4);
  return strips.map((strip) => {
    const stripW = strip.end - strip.start;
    const sub = cropBitmap(bmp, strip.start, 0, stripW, bmp.height);
    const tokens = findBands(projectRows(sub), 0, 3, 2);
    return tokens.map((t) =>
      tightXBounds(bmp, { x: strip.start, y: t.start, w: stripW, h: t.end - t.start }),
    );
  });
}
