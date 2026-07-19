import { describe, expect, it } from 'vitest';
import { binarize, grayscale, otsuThreshold, removeGridLines, type Bitmap } from './raster';
import { findBands, segmentCluePhoto } from './segment';

/** '#' = atrament. */
function bitmapFromStrings(art: string[]): Bitmap {
  const height = art.length;
  const width = art[0].length;
  const data = new Uint8Array(width * height);
  art.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      data[y * width + x] = ch === '#' ? 1 : 0;
    });
  });
  return { data, width, height };
}

describe('findBands', () => {
  it('znajduje ciągi powyżej progu', () => {
    expect(findBands([0, 3, 3, 0, 0, 0, 4, 4, 4, 0], 0, 1, 1)).toEqual([
      { start: 1, end: 3 },
      { start: 6, end: 9 },
    ]);
  });

  it('skleja pasma przedzielone małą przerwą', () => {
    expect(findBands([2, 2, 0, 0, 2, 2], 0, 2, 1)).toEqual([{ start: 0, end: 6 }]);
    expect(findBands([2, 2, 0, 0, 2, 2], 0, 1, 1)).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
  });

  it('odrzuca pasma krótsze niż minSize', () => {
    expect(findBands([0, 5, 0, 0, 5, 5, 5, 0], 0, 0, 2)).toEqual([{ start: 4, end: 7 }]);
  });
});

describe('removeGridLines', () => {
  it('usuwa linie poziome i pionowe, zostawia glify', () => {
    const bmp = bitmapFromStrings([
      '##########',
      '..........',
      '..##...#..',
      '..##...#..',
      '..##...#..',
      '..##...#..',
      '..........',
      '..........',
      '..........',
      '##########',
    ]);
    const cleaned = removeGridLines(bmp);
    expect([...cleaned.data.subarray(0, 10)]).toEqual(new Array(10).fill(0));
    expect([...cleaned.data.subarray(90, 100)]).toEqual(new Array(10).fill(0));
    expect(cleaned.data[2 * 10 + 2]).toBe(1); // glif w środku przetrwał
  });
});

describe('grayscale + otsu + binarize', () => {
  it('oddziela ciemne piksele od jasnych', () => {
    const width = 4;
    const height = 1;
    // dwa czarne, dwa białe piksele
    const data = new Uint8ClampedArray([
      10, 10, 10, 255, 245, 245, 245, 255, 20, 20, 20, 255, 250, 250, 250, 255,
    ]);
    const gray = grayscale({ data, width, height });
    const bmp = binarize(gray, width, height, otsuThreshold(gray));
    expect([...bmp.data]).toEqual([1, 0, 1, 0]);
  });
});

describe('segmentCluePhoto', () => {
  it('rows: dzieli na linie tekstu, a linie na liczby (sklejając cyfry)', () => {
    // Dwie linie tekstu; w drugiej dwie "cyfry" blisko siebie (jedna liczba
    // dwucyfrowa) oraz osobna liczba daleko.
    const bmp = bitmapFromStrings([
      '............................',
      '..####......................',
      '..####......................',
      '..####......................',
      '..####......................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '..####.####.........####....',
      '..####.####.........####....',
      '..####.####.........####....',
      '..####.####.........####....',
      '............................',
    ]);
    const lines = segmentCluePhoto(bmp, 'rows');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(1);
    // przerwa 1px między '####' a '####' < progu sklejania → jeden token
    expect(lines[1]).toHaveLength(2);
    expect(lines[1][0].w).toBe(9);
    expect(lines[1][1].x).toBeGreaterThan(15);
  });

  it('cols: dzieli na kolumny, a kolumny na liczby jedna pod drugą', () => {
    const bmp = bitmapFromStrings([
      '................',
      '..####....####..',
      '..####....####..',
      '..####....####..',
      '..####....####..',
      '................',
      '................',
      '................',
      '................',
      '..####....####..',
      '..####....####..',
      '..####....####..',
      '..####....####..',
      '................',
    ]);
    const lines = segmentCluePhoto(bmp, 'cols');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(2); // dwie liczby w pierwszej kolumnie
    expect(lines[1]).toHaveLength(2);
  });

  it('rows: tokeny mają zacieśnione granice', () => {
    const bmp = bitmapFromStrings([
      '.......',
      '..##...',
      '..##...',
      '..##...',
      '..##...',
      '.......',
    ]);
    const lines = segmentCluePhoto(bmp, 'rows');
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toEqual({ x: 2, y: 1, w: 2, h: 4 });
  });
});
