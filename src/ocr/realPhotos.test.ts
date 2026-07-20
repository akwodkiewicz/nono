import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode } from 'jpeg-js';
import { Solver } from '../solver/solver';
import { validatePuzzle } from '../solver/validate';
import { adaptiveBinarize, downscaleRgba, grayscale } from './raster';
import { prepareCluePhoto, segmentCluePhoto, type Orientation } from './segment';

/**
 * Regresja na PRAWDZIWYCH zdjęciach zagadki 45x30 z gazety (test-fixtures/):
 * wygięta kartka, cienkie linie separatorów, ślady ołówka, brzeg okładki
 * i kawałek planszy w kadrze. real-puzzle.json to ręcznie zweryfikowane
 * wartości wskazówek ("ver" = wiersze, "hor" = kolumny).
 */
const fixture = (name: string) => new URL(`../../test-fixtures/${name}`, import.meta.url).pathname;

const truth = JSON.parse(fs.readFileSync(fixture('real-puzzle.json'), 'utf8')) as {
  ver: number[][];
  hor: number[][];
};

function segmentPhoto(name: string, orientation: Orientation) {
  const raw = decode(fs.readFileSync(fixture(name)), { maxMemoryUsageInMB: 1024 });
  const image = downscaleRgba(
    {
      data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.length),
      width: raw.width,
      height: raw.height,
    },
    2600,
  );
  const gray = grayscale(image);
  const radius = Math.round(Math.max(image.width, image.height) / 32);
  const bin = adaptiveBinarize(gray, image.width, image.height, radius);
  return segmentCluePhoto(prepareCluePhoto(bin, orientation, gray), orientation);
}

describe('segmentacja prawdziwych zdjęć', () => {
  it('zdjęcie wskazówek wierszy: wszystkie linie i liczby tokenów', { timeout: 60000 }, () => {
    const lines = segmentPhoto('clues-rows.jpg', 'rows');
    expect(lines.map((tokens) => tokens.length)).toEqual(truth.ver.map((clue) => clue.length));
  });

  it('zdjęcie wskazówek kolumn: wszystkie linie i liczby tokenów', { timeout: 60000 }, () => {
    const lines = segmentPhoto('clues-cols.jpg', 'cols');
    expect(lines.map((tokens) => tokens.length)).toEqual(truth.hor.map((clue) => clue.length));
  });
});

describe('prawdziwa zagadka 45x30', () => {
  it('przechodzi walidację i rozwiązuje się samą logiką (bez zgadywania)', () => {
    const puzzle = { rowClues: truth.ver, colClues: truth.hor };
    expect(validatePuzzle(puzzle)).toEqual([]);
    const solver = new Solver(puzzle);
    const result = solver.run();
    expect(result.status).toBe('solved');
    expect(solver.unknownCount()).toBe(0);
  });
});
