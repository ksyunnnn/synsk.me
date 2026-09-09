import { describe, expect, it } from 'vitest';

import { bypassCacheUrl, extractChunkPaths, isPng } from '../../scripts/lib/verify-deploy.mjs';

/**
 * `scripts/verify-deploy.mjs` が判定に使う材料を検査する。
 *
 * 検査の本体はデプロイ後の本番に触れるため、ここでは扱えない。抽出と判定の
 * 部分だけを固定する。#71 の原因は、キャッシュ済みの HTML から抽出した
 * チャンクを配信中の版に求めたことだった。
 */

describe('extractChunkPaths', () => {
  it('src と href の両方から拾い、重複を除く', () => {
    const html = `
      <link rel="modulepreload" href="/_next/static/chunks/index-abc123.js"/>
      <script src="/_next/static/chunks/index-abc123.js"></script>
      <script src="/_next/static/chunks/vinext-def456.js"></script>
    `;
    expect(extractChunkPaths(html)).toEqual([
      '/_next/static/chunks/index-abc123.js',
      '/_next/static/chunks/vinext-def456.js',
    ]);
  });

  it('`_next/static` の外の JS は拾わない', () => {
    const html = `
      <script src="https://kit.fontawesome.com/fa9c201f80.js"></script>
      <script src="/other/app.js"></script>
      <script src="/_next/static/chunks/index-abc123.js"></script>
    `;
    expect(extractChunkPaths(html)).toEqual(['/_next/static/chunks/index-abc123.js']);
  });

  it('参照がなければ空を返す', () => {
    expect(extractChunkPaths('<html><body>工事中</body></html>')).toEqual([]);
  });
});

describe('isPng', () => {
  it('先頭 8 バイトが PNG の署名なら true', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(isPng(bytes)).toBe(true);
  });

  it('署名が違えば false', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(isPng(bytes)).toBe(false);
  });

  it('署名より短ければ false。200 でも中身が空という出方をするため', () => {
    expect(isPng(new Uint8Array([0x89, 0x50]))).toBe(false);
    expect(isPng(new Uint8Array([]))).toBe(false);
  });
});

describe('bypassCacheUrl', () => {
  it('エッジのキャッシュを迂回するクエリを足す', () => {
    expect(bypassCacheUrl('https://synsk.me', '/', '1788800000000')).toBe(
      'https://synsk.me/?__verify=1788800000000',
    );
  });

  it('経路を保つ', () => {
    expect(bypassCacheUrl('https://synsk.me', '/archives/2024', 'x')).toBe(
      'https://synsk.me/archives/2024?__verify=x',
    );
  });

  it('プレビュー配信の URL でも同じ形になる', () => {
    expect(
      bypassCacheUrl('https://ea015945-synsk-me.is-syunsukekobashi.workers.dev', '/', 'x'),
    ).toBe('https://ea015945-synsk-me.is-syunsukekobashi.workers.dev/?__verify=x');
  });
});
