import { describe, expect, it } from 'vitest';
import { formatClue, parseClueText } from './clueText';

describe('parseClueText', () => {
  it('parsuje liczby oddzielone spacjami i przecinkami', () => {
    expect(parseClueText('3 1 2')).toEqual([3, 1, 2]);
    expect(parseClueText(' 3, 1,2 ')).toEqual([3, 1, 2]);
    expect(parseClueText('10')).toEqual([10]);
  });

  it('akceptuje kropkę i myślnik jako separatory (klawiatura numeryczna)', () => {
    expect(parseClueText('3.1.2')).toEqual([3, 1, 2]);
    expect(parseClueText('3-1-2')).toEqual([3, 1, 2]);
    expect(parseClueText('3. 1,2-4')).toEqual([3, 1, 2, 4]);
  });

  it('pusty tekst to pusta linia', () => {
    expect(parseClueText('')).toEqual([]);
    expect(parseClueText('   ')).toEqual([]);
    expect(parseClueText('0')).toEqual([0]);
  });

  it('odrzuca nie-liczby', () => {
    expect(parseClueText('3 a')).toBeNull();
    expect(parseClueText('x')).toBeNull();
    expect(parseClueText('3?1')).toBeNull();
  });
});

describe('formatClue', () => {
  it('formatuje z pominięciem zer', () => {
    expect(formatClue([3, 1, 2])).toBe('3 1 2');
    expect(formatClue([0])).toBe('');
    expect(formatClue([])).toBe('');
  });
});
