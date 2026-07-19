import { describe, expect, it } from 'vitest';
import { formatClue, parseClueText } from './clueText';

describe('parseClueText', () => {
  it('parsuje liczby oddzielone spacjami i przecinkami', () => {
    expect(parseClueText('3 1 2')).toEqual([3, 1, 2]);
    expect(parseClueText(' 3, 1,2 ')).toEqual([3, 1, 2]);
    expect(parseClueText('10')).toEqual([10]);
  });

  it('pusty tekst to pusta linia', () => {
    expect(parseClueText('')).toEqual([]);
    expect(parseClueText('   ')).toEqual([]);
    expect(parseClueText('0')).toEqual([0]);
  });

  it('odrzuca nie-liczby', () => {
    expect(parseClueText('3 a')).toBeNull();
    expect(parseClueText('1.5')).toBeNull();
    expect(parseClueText('-2')).toBeNull();
  });
});

describe('formatClue', () => {
  it('formatuje z pominięciem zer', () => {
    expect(formatClue([3, 1, 2])).toBe('3 1 2');
    expect(formatClue([0])).toBe('');
    expect(formatClue([])).toBe('');
  });
});
