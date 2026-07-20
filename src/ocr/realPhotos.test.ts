import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode } from 'jpeg-js';
import { Solver } from '../solver/solver';
import { validatePuzzle } from '../solver/validate';
import type { Puzzle } from '../solver/types';
import { adaptiveBinarize, downscaleRgba, grayscale } from './raster';
import { findSplitColumn, prepareCluePhoto, segmentCluePhoto, type Orientation } from './segment';

/**
 * Regresja na PRAWDZIWYCH zdjęciach zagadek z gazet (test-fixtures/):
 * wygięte kartki, cienkie linie separatorów, ślady ołówka, brzeg okładki
 * i kawałek planszy w kadrze. Pliki real-puzzle*.json to ręcznie
 * zweryfikowane wartości wskazówek.
 */
const fixture = (name: string) => new URL(`../../test-fixtures/${name}`, import.meta.url).pathname;

function loadTruth(name: string): Puzzle {
  const raw = JSON.parse(fs.readFileSync(fixture(name), 'utf8')) as Record<string, number[][]>;
  return { rowClues: raw.rowClues ?? raw.ver, colClues: raw.colClues ?? raw.hor };
}

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
  const prepared = prepareCluePhoto(bin, orientation, gray);
  return segmentCluePhoto(prepared.bitmap, orientation);
}

const examples = [
  { name: 'zagadka 45x30 (łabędź)', truth: 'real-puzzle.json', rows: 'clues-rows.jpg', cols: 'clues-cols.jpg' },
  { name: 'zagadka 45x30 (przykład 2)', truth: 'real-puzzle2.json', rows: 'clues2-rows.jpg', cols: 'clues2-cols.jpg' },
];

for (const example of examples) {
  describe(`segmentacja: ${example.name}`, () => {
    const truth = loadTruth(example.truth);

    it('zdjęcie wskazówek wierszy: wszystkie linie i liczby tokenów', { timeout: 60000 }, () => {
      const lines = segmentPhoto(example.rows, 'rows');
      expect(lines.map((tokens) => tokens.length)).toEqual(
        truth.rowClues.map((clue) => clue.length),
      );
    });

    it('zdjęcie wskazówek kolumn: wszystkie linie i liczby tokenów', { timeout: 60000 }, () => {
      const lines = segmentPhoto(example.cols, 'cols');
      expect(lines.map((tokens) => tokens.length)).toEqual(
        truth.colClues.map((clue) => clue.length),
      );
    });

    it('zagadka przechodzi walidację i rozwiązuje się samą logiką', () => {
      const puzzle = loadTruth(example.truth);
      expect(validatePuzzle(puzzle)).toEqual([]);
      const solver = new Solver(puzzle);
      expect(solver.run().status).toBe('solved');
      expect(solver.unknownCount()).toBe(0);
    });
  });
}

describe('findSplitColumn', () => {
  const bitmap = (art: string[]) => ({
    data: Uint8Array.from(art.flatMap((row) => [...row].map((ch) => (ch === '#' ? 1 : 0)))),
    width: art[0].length,
    height: art.length,
  });

  it('znajduje dolinę między cyframi liczby dwucyfrowej', () => {
    const token = bitmap(['##..##', '##..##', '##..##']);
    const split = findSplitColumn(token);
    expect(split).not.toBeNull();
    expect(split).toBeGreaterThanOrEqual(2);
    expect(split).toBeLessThan(4);
  });

  it('nie rozcina pojedynczej cyfry bez przerwy', () => {
    expect(findSplitColumn(bitmap(['######', '######', '######']))).toBeNull();
  });
});
