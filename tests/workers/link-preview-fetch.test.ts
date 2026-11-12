import { describe, expect, it } from 'vitest';
import {
  fetchLinkPreview,
  type LinkPreviewFetcher,
} from '@/features/note/server/link-preview-fetch';

/**
 * 参照先の取得（src/features/note/server/link-preview-fetch.ts）が workerd の `Response`・`TextDecoder`・
 * 中止の合図の上で動くこと。外へ要求を出さず、作り物の応答を返す `fetcher` を渡す。読み方の細部は
 * tests/unit/link-preview-fetch.test.ts が持つ
 */

const LIMITS = { maxUrls: 5, maxRedirects: 2, timeoutMs: 200, maxBytes: 4096 };

// 「日本」の Shift_JIS と EUC-JP のバイト
const SHIFT_JIS = [0x93, 0xfa, 0x96, 0x7b];
const EUC_JP = [0xc6, 0xfc, 0xcb, 0xdc];

const page = (titleBytes: number[], charset: string): LinkPreviewFetcher => {
  const encoder = new TextEncoder();
  return async () =>
    new Response(
      new Uint8Array([
        ...encoder.encode('<html><head><title>'),
        ...titleBytes,
        ...encoder.encode('</title></head></html>'),
      ]),
      { status: 200, headers: { 'Content-Type': `text/html; charset=${charset}` } },
    );
};

describe('fetchLinkPreview（workerd）', () => {
  it.each([
    ['Shift_JIS', SHIFT_JIS],
    ['EUC-JP', EUC_JP],
  ])('Content-Type の charset が %s のページの題を読む', async (charset, bytes) => {
    expect(
      await fetchLinkPreview('https://example.com/a', {
        fetcher: page(bytes, charset),
        limits: LIMITS,
      }),
    ).toMatchObject({ status: 'fetched', title: '日本' });
  });

  it('Content-Type に charset が無ければ、meta の宣言の Shift_JIS で題を読む', async () => {
    const encoder = new TextEncoder();
    const fetcher: LinkPreviewFetcher = async () =>
      new Response(
        new Uint8Array([
          ...encoder.encode('<html><head><meta charset="Shift_JIS"><title>'),
          ...SHIFT_JIS,
          ...encoder.encode('</title></head></html>'),
        ]),
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ status: 'fetched', title: '日本' });
  });

  it('リダイレクトの応答を辿り、行き先の題を読む', async () => {
    const fetcher: LinkPreviewFetcher = async (url) =>
      url === 'https://example.com/a'
        ? Response.redirect('https://example.com/b', 301)
        : new Response('<title>行き先</title>', { headers: { 'Content-Type': 'text/html' } });
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ status: 'fetched', title: '行き先' });
  });

  it('待ち時間を超えたら失敗にする', async () => {
    const fetcher: LinkPreviewFetcher = (_url, init) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('中止'))),
      );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ status: 'failed', reason: 'timeout' });
  });
});
