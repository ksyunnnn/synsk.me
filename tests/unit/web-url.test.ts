import { describe, expect, it } from 'vitest';
import { normalizeWebUrl } from '@/shared/domain/web-url';

/**
 * 同じ項目かを判定するための URL の揃え方（src/shared/domain/web-url.ts の normalizeWebUrl）。
 * 004 の FR-005・FR-008 と、003 の転載先（ADR-0006、FR-032）が使う
 */

describe('normalizeWebUrl', () => {
  it.each([
    ['HTTPS://Zenn.DEV/ksyunnnn/articles/a', 'https://zenn.dev/ksyunnnn/articles/a'],
    ['https://zenn.dev:443/a', 'https://zenn.dev/a'],
    ['http://example.com:80/a', 'http://example.com/a'],
    ['https://example.com', 'https://example.com/'],
    ['https://example.com/a/./b/../c', 'https://example.com/a/c'],
    ['https://example.com/a#section', 'https://example.com/a'],
    ['https://example.com/a%2fb?q=%e3%81%82', 'https://example.com/a%2Fb?q=%E3%81%82'],
    ['  https://example.com/a  ', 'https://example.com/a'],
    ['https://例え.jp/', 'https://xn--r8jz45g.jp/'],
  ])('%s を %s に揃える', (value, expected) => {
    expect(normalizeWebUrl(value)).toBe(expected);
  });

  it.each([
    ['パスの大文字と小文字', 'https://example.com/Ksyunnnn', 'https://example.com/ksyunnnn'],
    ['末尾のスラッシュ', 'https://example.com/a/', 'https://example.com/a'],
    ['クエリ', 'https://www.youtube.com/watch?v=a', 'https://www.youtube.com/watch?v=b'],
    ['www. の有無', 'https://www.example.com/a', 'https://example.com/a'],
    ['http と https', 'http://example.com/a', 'https://example.com/a'],
    ['既定でないポート', 'https://example.com:8443/a', 'https://example.com/a'],
  ])('%s が違えば別の URL のままにする', (_name, a, b) => {
    expect(normalizeWebUrl(a)).not.toBe(normalizeWebUrl(b));
  });

  it.each(['', 'example.com/a', 'ftp://example.com/a', 'javascript:alert(1)', 'https://'])(
    '%j は null',
    (value) => {
      expect(normalizeWebUrl(value)).toBeNull();
    },
  );
});
