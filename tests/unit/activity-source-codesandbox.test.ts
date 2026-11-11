import { describe, expect, it } from 'vitest';
import { fetchByUrl } from '@/features/activity/server/sources/codesandbox';
import type { FetchLimits } from '@/features/activity/domain/limits';
import { createFakeFetcher } from '../support/activity-fakes';

/**
 * CodeSandbox の `/embed/<id>` の OG メタを `FetchedItem` に詰め替える（#177「CodePen と
 * CodeSandbox を手で登録できるようにする」、FR-009、research.md の R7・R10）。公式の oEmbed は
 * 403 を返すため、非公式の経路を使う。応答の形は PR #47 の検証記録と 2026-11-09 の実測に合わせた作り物
 */

const LIMITS: FetchLimits = { maxRequests: 1, timeoutMs: 1000, maxBytes: 1_000_000 };
const EMBED = 'https://codesandbox.io/embed/fake-sandbox-000';

const html = (title: string) =>
  `<!doctype html><html><head><title>Embed - CodeSandbox</title><meta property="og:title" content="${title}"><meta property="og:image" content="https://codesandbox.io/api/v1/sandboxes/fake/screenshot.png"></head><body></body></html>`;

const page = (title: string) => () =>
  new Response(html(title), { headers: { 'Content-Type': 'text/html' } });

describe('CodeSandbox', () => {
  it.each([
    'https://codesandbox.io/s/fake-sandbox-000',
    'https://codesandbox.io/embed/fake-sandbox-000',
    'https://codesandbox.io/p/sandbox/fake-sandbox-000',
  ])('%s から埋め込みの頁を読み、og:title を題にする。画像は取らない', async (url) => {
    const { fetcher, requested } = createFakeFetcher({
      [EMBED]: page('作り物の sandbox &amp; 例 - CodeSandbox'),
    });

    expect(await fetchByUrl(fetcher, url, LIMITS)).toEqual({
      url,
      title: '作り物の sandbox & 例 - CodeSandbox',
    });
    expect(requested.map((request) => request.url)).toEqual([EMBED]);
  });

  it('og:title がサイトの既定値（無い ID でも 200 で返る）なら取れない（null）', async () => {
    const { fetcher } = createFakeFetcher({ [EMBED]: page('CodeSandbox') });

    expect(
      await fetchByUrl(fetcher, 'https://codesandbox.io/s/fake-sandbox-000', LIMITS),
    ).toBeNull();
  });

  it.each([
    'https://codesandbox.io/dashboard',
    'https://evil.example/s/fake-sandbox-000',
    'URL でない',
  ])('%s には要求を出さず、取れない（null）', async (url) => {
    const { fetcher, requested } = createFakeFetcher({});

    expect(await fetchByUrl(fetcher, url, LIMITS)).toBeNull();
    expect(requested).toEqual([]);
  });

  it('og:title の属性の順と引用符に依らず読み、実体参照を解く', async () => {
    const { fetcher } = createFakeFetcher({
      [EMBED]: () =>
        new Response(
          `<meta data-content="違う" content='Tom&apos;s demo &#x2014; v2' property='og:title'>`,
        ),
    });

    expect(await fetchByUrl(fetcher, 'https://codesandbox.io/s/fake-sandbox-000', LIMITS)).toEqual({
      url: 'https://codesandbox.io/s/fake-sandbox-000',
      title: "Tom's demo \u2014 v2",
    });
  });
});
