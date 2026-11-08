import { describe, expect, it, vi } from 'vitest';
import {
  LINK_PREVIEW_MAX_BYTES,
  fetchLinkPreview,
  fetchLinkPreviews,
  parseLinkPreviewHtml,
} from '@/features/note/server/link-preview-fetcher';
import { LINK_PREVIEW_MAX_FETCHES } from '@/features/note/domain/link-card';

/**
 * 参照先の HTML から題と画像を取る（specs/003-note/research.md の R9）。参照先へは取りに行かず、
 * 作り物の fetch を渡す
 */

const html = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

const respond = (body: string, init: ResponseInit = {}) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });

describe('parseLinkPreviewHtml', () => {
  it('og:title と og:image を読む。属性の順を問わない', () => {
    expect(
      parseLinkPreviewHtml(
        html(
          `<meta content="作り物の題 &amp; 副題" property="og:title"><meta property='og:image' content='https://example.com/og.png'><title>別の題</title>`,
        ),
      ),
    ).toEqual({ title: '作り物の題 & 副題', image: 'https://example.com/og.png' });
  });

  it('og:title が無ければ <title> を使う', () => {
    expect(parseLinkPreviewHtml(html('<title>\n 作り物の題 \n</title>'))).toEqual({
      title: '作り物の題',
      image: null,
    });
  });
});

describe('fetchLinkPreview', () => {
  it('題と、https の画像の URL を返す', async () => {
    const fetch = vi.fn(async () =>
      respond(
        html(
          '<meta property="og:title" content="作り物"><meta property="og:image" content="/og.png">',
        ),
      ),
    );
    expect(await fetchLinkPreview('https://example.com/a', fetch)).toEqual({
      url: 'https://example.com/a',
      title: '作り物',
      imageUrl: 'https://example.com/og.png',
    });
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('HTML でない応答・失敗した応答・投げた fetch は null', async () => {
    expect(
      await fetchLinkPreview('https://example.com/a', async () =>
        respond('{}', { headers: { 'content-type': 'application/json' } }),
      ),
    ).toBeNull();
    expect(
      await fetchLinkPreview('https://example.com/a', async () => respond('', { status: 500 })),
    ).toBeNull();
    expect(
      await fetchLinkPreview('https://example.com/a', async () => {
        throw new Error('timeout');
      }),
    ).toBeNull();
  });

  it('本文は 512 KB までしか読まない。それより後の題は読まない', async () => {
    const padding = 'a'.repeat(LINK_PREVIEW_MAX_BYTES);
    const result = await fetchLinkPreview('https://example.com/a', async () =>
      respond(`<html><head><!-- ${padding} --><title>後ろの題</title></head></html>`),
    );
    expect(result).toBeNull();
  });
});

describe('fetchLinkPreviews', () => {
  it('上限の数を超えた分は取りに行かず、取れなかった URL を除いて返す', async () => {
    const urls = Array.from(
      { length: LINK_PREVIEW_MAX_FETCHES + 3 },
      (_, i) => `https://example.com/${i}`,
    );
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/0') ? respond('', { status: 404 }) : respond(html(`<title>${url}</title>`)),
    );
    const previews = await fetchLinkPreviews(urls, fetch);
    expect(fetch).toHaveBeenCalledTimes(LINK_PREVIEW_MAX_FETCHES);
    expect(previews).toHaveLength(LINK_PREVIEW_MAX_FETCHES - 1);
  });
});
