import { describe, expect, it } from 'vitest';
import { readString, readStrings, readValues } from '@/shared/server/form-data';

const form = (entries: [string, string | Blob][]) => {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
};

describe('readString', () => {
  it('送られた値を返し、同じ名前が並べば最初の値を返す', () => {
    expect(
      readString(
        form([
          ['a', ' x '],
          ['a', 'y'],
        ]),
        'a',
      ),
    ).toBe(' x ');
  });

  it('送られていない項目とファイルは空の文字列', () => {
    expect(readString(form([]), 'a')).toBe('');
    expect(readString(form([['a', new Blob(['x'])]]), 'a')).toBe('');
  });
});

describe('readStrings', () => {
  it('同じ名前の値を送られた順に返し、ファイルを除く', () => {
    expect(
      readStrings(
        form([
          ['a', '2'],
          ['a', new Blob(['x'])],
          ['a', '1'],
        ]),
        'a',
      ),
    ).toEqual(['2', '1']);
    expect(readStrings(form([]), 'a')).toEqual([]);
  });
});

describe('readValues', () => {
  it('項目ごとに readString と同じ値を読む', () => {
    expect(
      readValues(
        form([
          ['a', '1'],
          ['c', 'x'],
        ]),
        ['a', 'b'] as const,
      ),
    ).toEqual({
      a: '1',
      b: '',
    });
  });
});
