import { describe, expect, it } from 'vitest';
import { extractCardUrls, toCardUrl, toPreviewImageUrl } from '@/features/note/domain/link-card';

/** 本文のどの URL をカードにするか（specs/003-note/research.md の R9） */

describe('extractCardUrls', () => {
  it('URL 1 つだけの段落をカードにし、文の中のリンクはカードにしない', () => {
    const body = [
      '作り物の段落 https://example.com/inline を含む',
      '',
      'https://example.com/card',
      '',
      '<https://example.com/angle>',
    ].join('\n');
    expect(extractCardUrls(body)).toEqual([
      'https://example.com/card',
      'https://example.com/angle',
    ]);
  });

  it('2 行以上の段落と、コードの塊の中はカードにしない', () => {
    const body = [
      'https://example.com/a',
      'https://example.com/b',
      '',
      '```',
      'https://example.com/in-code',
      '```',
    ].join('\n');
    expect(extractCardUrls(body)).toEqual([]);
  });

  it('同じ URL は 1 つにする', () => {
    expect(extractCardUrls('https://example.com/x\n\nhttps://example.com/x')).toEqual([
      'https://example.com/x',
    ]);
  });
});

describe('toCardUrl', () => {
  it('http と https の URL だけを通す', () => {
    expect(toCardUrl('https://example.com')).toBe('https://example.com');
    expect(toCardUrl('javascript:alert(1)')).toBeNull();
    expect(toCardUrl('ftp://example.com')).toBeNull();
  });
});

describe('toPreviewImageUrl', () => {
  it('https の画像の URL だけを持ち、相対の URL は参照先の URL で解く', () => {
    expect(toPreviewImageUrl('/og.png', 'https://example.com/a')).toBe(
      'https://example.com/og.png',
    );
    expect(toPreviewImageUrl('http://example.com/og.png', 'https://example.com/a')).toBeNull();
    expect(toPreviewImageUrl(null, 'https://example.com/a')).toBeNull();
  });
});
