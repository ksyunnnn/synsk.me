import { describe, expect, it } from 'vitest';
import {
  fetchLinkPreview,
  fetchLinkPreviews,
  isFetchableUrl,
  LINK_PREVIEW_LIMITS,
  readLinkPreview,
  type LinkPreviewFetcher,
  type LinkPreviewLimits,
} from '@/shared/server/link-preview-fetch';

/**
 * 参照先のページから題と画像の URL を取る部品（specs/003-note/research.md の R13、plan.md の
 * 「参照先への取得の上限」）。外へ要求を出さず、作り物の応答を返す `fetcher` を渡す
 */

const LIMITS: LinkPreviewLimits = { maxUrls: 2, maxRedirects: 2, timeoutMs: 50, maxBytes: 1024 };

const html = (head: string, contentType = 'text/html; charset=utf-8') =>
  new Response(`<!doctype html><html><head>${head}</head><body>本文</body></html>`, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });

const redirect = (location: string, status = 302) =>
  new Response(null, { status, headers: { Location: location } });

describe('readLinkPreview', () => {
  const PAGE = 'https://example.com/articles/1';

  it('og:title と og:image を読む', () => {
    expect(
      readLinkPreview(
        '<meta property="og:title" content="記事の題"><meta property="og:image" content="https://cdn.example.com/a.png">',
        PAGE,
      ),
    ).toEqual({ title: '記事の題', imageUrl: 'https://cdn.example.com/a.png' });
  });

  it('og:title が無ければ twitter:title、それも無ければ <title> を読む', () => {
    expect(
      readLinkPreview('<meta name="twitter:title" content="X の題"><title>題</title>', PAGE).title,
    ).toBe('X の題');
    expect(readLinkPreview('<title>\n  ページの題\n</title>', PAGE).title).toBe('ページの題');
  });

  it('og:image が無ければ twitter:image を読み、相対の URL をページの URL で絶対にする', () => {
    expect(readLinkPreview('<meta name="twitter:image" content="/img/b.png">', PAGE).imageUrl).toBe(
      'https://example.com/img/b.png',
    );
  });

  it('属性の順・引用符・大文字小文字の違いを読む', () => {
    expect(
      readLinkPreview(
        "<META content='題' PROPERTY='og:title'><meta content=https://example.com/c.png property=og:image>",
        PAGE,
      ),
    ).toEqual({ title: '題', imageUrl: 'https://example.com/c.png' });
  });

  it('文字参照を文字に戻し、空白をつめる', () => {
    expect(
      readLinkPreview(
        '<meta property="og:title" content="A &amp; B &#x3042;&#12354; &quot;q&quot;  &lt;tag&gt;">',
        PAGE,
      ).title,
    ).toBe('A & B ああ "q" <tag>');
  });

  it('題によく現れる名前の文字参照を文字に戻す', () => {
    expect(
      readLinkPreview(
        '<title>A &raquo; B &hellip; &ndash; &mdash; &rsquo;s &copy; &laquo;</title>',
        PAGE,
      ).title,
    ).toBe('A » B … – — ’s © «');
  });

  it('引用符の中の > で meta の要素を切らない', () => {
    expect(
      readLinkPreview(
        '<meta content="Docs > Guide" property="og:title"><meta property="og:image" content=\'/a>b.png\'>',
        PAGE,
      ),
    ).toEqual({ title: 'Docs > Guide', imageUrl: 'https://example.com/a%3Eb.png' });
  });

  it('題は 200 文字で切る', () => {
    const title = readLinkPreview(`<title>${'あ'.repeat(250)}</title>`, PAGE).title;
    expect(title).toHaveLength(200);
  });

  it('http か https でない画像の URL は持たない', () => {
    expect(
      readLinkPreview('<meta property="og:image" content="javascript:alert(1)">', PAGE).imageUrl,
    ).toBeNull();
    expect(
      readLinkPreview('<meta property="og:image" content="data:image/png;base64,AAAA">', PAGE)
        .imageUrl,
    ).toBeNull();
  });

  it('注釈とスクリプトの中の meta は読まない', () => {
    expect(
      readLinkPreview(
        '<!-- <meta property="og:title" content="注釈"> --><script>"<meta property=\\"og:title\\" content=\\"台本\\">"</script><title>本物</title>',
        PAGE,
      ).title,
    ).toBe('本物');
  });

  it('題も画像も無ければ null', () => {
    expect(readLinkPreview('<meta charset="utf-8">', PAGE)).toEqual({
      title: null,
      imageUrl: null,
    });
    expect(readLinkPreview('<title>   </title>', PAGE).title).toBeNull();
  });
});

describe('isFetchableUrl', () => {
  it.each(['https://example.com/a', 'http://sub.example.co.jp/b?c=d', 'https://example.com./a'])(
    '%s を通す',
    (url) => expect(isFetchableUrl(new URL(url))).toBe(true),
  );

  it.each([
    'ftp://example.com/a',
    'file:///etc/passwd',
    'https://user:pass@example.com/a',
    'https://example.com:8443/a',
    'http://localhost/a',
    'http://app.localhost/a',
    'http://printer.local/a',
    'http://metadata.google.internal/a',
    'http://router.home.arpa/a',
    'https://unfetched.invalid/a',
    'https://synsk.test/a',
    'http://intranet/a',
    'http://127.0.0.1/a',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/a',
    'http://2130706433/a',
    'http://0x7f.1/a',
    'http://[::1]/a',
    'http://[::ffff:127.0.0.1]/a',
    // 末尾の点が 2 つ以上あると、URL の解析は IPv4 に揃えず、点 1 つを除いても内部の名前の形に合わない
    'http://localhost../a',
    'http://app.localhost../a',
    'http://127.0.0.1../a',
  ])('%s を拒む', (url) => expect(isFetchableUrl(new URL(url))).toBe(false));
});

describe('fetchLinkPreview', () => {
  it('User-Agent を付け、リダイレクトを自動で辿らずに要求し、題と画像の URL を返す', async () => {
    const seen: RequestInit[] = [];
    const fetcher: LinkPreviewFetcher = async (_url, init) => {
      seen.push(init ?? {});
      return html(
        '<meta property="og:title" content="題"><meta property="og:image" content="/i.png">',
      );
    };

    expect(await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS })).toEqual({
      status: 'fetched',
      url: 'https://example.com/a',
      title: '題',
      imageUrl: 'https://example.com/i.png',
    });
    expect(new Headers(seen[0]?.headers).get('User-Agent')).toBe('synsk.me (+https://synsk.me)');
    expect(seen[0]?.redirect).toBe('manual');
  });

  it('拒む URL には要求を出さない', async () => {
    let calls = 0;
    const fetcher: LinkPreviewFetcher = async () => {
      calls += 1;
      return html('');
    };
    expect(await fetchLinkPreview('http://127.0.0.1/a', { fetcher, limits: LIMITS })).toEqual({
      status: 'failed',
      url: 'http://127.0.0.1/a',
      reason: 'blocked',
    });
    expect(calls).toBe(0);
  });

  it('リダイレクトを 1 段ずつ辿り、行き先の題を読み、画像の URL を行き先のページで絶対にする', async () => {
    const requested: string[] = [];
    const fetcher: LinkPreviewFetcher = async (url) => {
      requested.push(url);
      if (url === 'https://example.com/a') return redirect('/b', 301);
      if (url === 'https://example.com/b') return redirect('https://other.example.org/c/d');
      return html('<title>行き先</title><meta property="og:image" content="e.png">');
    };

    const result = await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS });

    expect(requested).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://other.example.org/c/d',
    ]);
    expect(result).toEqual({
      status: 'fetched',
      url: 'https://example.com/a',
      title: '行き先',
      imageUrl: 'https://other.example.org/c/e.png',
    });
  });

  it('リダイレクトの行き先が拒む URL なら要求を出さずに失敗にする', async () => {
    const requested: string[] = [];
    const fetcher: LinkPreviewFetcher = async (url) => {
      requested.push(url);
      return redirect('http://169.254.169.254/latest/meta-data');
    };
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'failed',
      reason: 'blocked',
    });
    expect(requested).toEqual(['https://example.com/a']);
  });

  it('リダイレクトが上限を超えたら失敗にする', async () => {
    let calls = 0;
    const fetcher: LinkPreviewFetcher = async () => {
      calls += 1;
      return redirect(`https://example.com/${calls}`);
    };
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'failed',
      reason: 'too-many-redirects',
    });
    // 最初の要求と、上限の 2 段
    expect(calls).toBe(LIMITS.maxRedirects + 1);
  });

  it('2xx でない応答は失敗にする', async () => {
    const fetcher: LinkPreviewFetcher = async () => new Response('無い', { status: 404 });
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'failed',
      reason: 'http',
    });
  });

  it('要求が投げたら失敗にし、投げ返さない', async () => {
    const fetcher: LinkPreviewFetcher = async () => {
      throw new TypeError('fetch failed');
    };
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'failed',
      reason: 'network',
    });
  });

  it('待ち時間を超えたら、fetcher が中止の合図を見なくても失敗にする', async () => {
    const fetcher: LinkPreviewFetcher = () => new Promise(() => {});
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'failed',
      reason: 'timeout',
    });
  });

  it('本文を読む途中で待ち時間を超えても失敗にする', async () => {
    const fetcher: LinkPreviewFetcher = async () =>
      new Response(new ReadableStream({ start: () => {} }), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'failed',
      reason: 'timeout',
    });
  });

  it('HTML でない応答は読まず、題も画像も無い取得にする', async () => {
    const fetcher: LinkPreviewFetcher = async () =>
      new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    expect(
      await fetchLinkPreview('https://example.com/a.pdf', { fetcher, limits: LIMITS }),
    ).toEqual({
      status: 'fetched',
      url: 'https://example.com/a.pdf',
      title: null,
      imageUrl: null,
    });
  });

  it('本文は大きさの上限までだけを読む', async () => {
    const fetcher: LinkPreviewFetcher = async () =>
      html(`<meta name="x" content="${'a'.repeat(2000)}"><title>上限の外</title>`);
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      status: 'fetched',
      title: null,
    });
  });

  it('</head> まで読んだら、残りを読まない', async () => {
    let pulled = 0;
    const encoder = new TextEncoder();
    const chunks = [
      '<html><head><title>題</title></he',
      'ad><body>',
      'x'.repeat(100),
      'y'.repeat(100),
    ];
    const fetcher: LinkPreviewFetcher = async () =>
      new Response(
        new ReadableStream({
          pull: (controller) => {
            const chunk = chunks[pulled];
            pulled += 1;
            if (chunk === undefined) controller.close();
            else controller.enqueue(encoder.encode(chunk));
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      title: '題',
    });
    expect(pulled).toBeLessThan(chunks.length);
  });

  it('Content-Type の charset で文字を読む', async () => {
    const bytes = new Uint8Array([
      0x3c, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e, 0xe9, 0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65,
      0x3e,
    ]);
    const fetcher: LinkPreviewFetcher = async () =>
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=iso-8859-1' },
      });
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({
      title: 'é',
    });
  });

  // HTML の文字コードの判定（https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding）。
  // Content-Type に charset が無ければ、先頭 1024 バイトの meta の宣言で読む
  const SHIFT_JIS_NIHON = [0x93, 0xfa, 0x96, 0x7b];
  const bytesOf = (...parts: (string | number[])[]) =>
    new Uint8Array(
      parts.flatMap((part) =>
        typeof part === 'string' ? [...new TextEncoder().encode(part)] : part,
      ),
    );
  const bytesPage =
    (bytes: Uint8Array, contentType = 'text/html'): LinkPreviewFetcher =>
    async () =>
      new Response(bytes, { status: 200, headers: { 'Content-Type': contentType } });

  it.each([
    ['<meta charset="Shift_JIS">', '<meta charset="Shift_JIS">'],
    [
      '<meta http-equiv="Content-Type" content="text/html; charset=shift_jis">',
      '<meta http-equiv="Content-Type" content="text/html; charset=shift_jis">',
    ],
  ])('Content-Type に charset が無ければ %s で読む', async (_, declaration) => {
    const fetcher = bytesPage(
      bytesOf(`<html><head>${declaration}<title>`, SHIFT_JIS_NIHON, '</title></head>'),
    );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ title: '日本' });
  });

  it('Content-Type の charset は meta の宣言より先に使う', async () => {
    const fetcher = bytesPage(
      bytesOf('<head><meta charset="utf-8"><title>', SHIFT_JIS_NIHON, '</title></head>'),
      'text/html; charset=Shift_JIS',
    );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ title: '日本' });
  });

  it('BOM は Content-Type の charset より先に使う', async () => {
    const fetcher = bytesPage(
      bytesOf([0xef, 0xbb, 0xbf], '<head><title>日本</title></head>'),
      'text/html; charset=Shift_JIS',
    );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ title: '日本' });
  });

  it('</head> の大文字小文字とチャンクの境目に関わらず、そこで読むのを止める', async () => {
    let pulled = 0;
    const encoder = new TextEncoder();
    const chunks = [
      '<html><head><title>題</title></HE',
      'AD><body>',
      'x'.repeat(100),
      'y'.repeat(100),
    ];
    const fetcher: LinkPreviewFetcher = async () =>
      new Response(
        new ReadableStream({
          pull: (controller) => {
            const chunk = chunks[pulled];
            pulled += 1;
            if (chunk === undefined) controller.close();
            else controller.enqueue(encoder.encode(chunk));
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      );
    expect(
      await fetchLinkPreview('https://example.com/a', { fetcher, limits: LIMITS }),
    ).toMatchObject({ title: '題' });
    expect(pulled).toBeLessThan(chunks.length);
  });
});

describe('fetchLinkPreviews', () => {
  it('要求を出さない URL は上限の数に数えず、後ろの URL を取る', async () => {
    const requested: string[] = [];
    const fetcher: LinkPreviewFetcher = async (url) => {
      requested.push(url);
      return html(`<title>${url}</title>`);
    };

    const results = await fetchLinkPreviews(
      [
        'https://a.invalid/1',
        'http://localhost/2',
        'https://example.com/3',
        'https://example.com/4',
        'https://example.com/5',
      ],
      { fetcher, limits: LIMITS },
    );

    expect(results).toEqual([
      { status: 'failed', url: 'https://a.invalid/1', reason: 'blocked' },
      { status: 'failed', url: 'http://localhost/2', reason: 'blocked' },
      expect.objectContaining({ status: 'fetched', url: 'https://example.com/3' }),
      expect.objectContaining({ status: 'fetched', url: 'https://example.com/4' }),
    ]);
    expect(requested.sort()).toEqual(['https://example.com/3', 'https://example.com/4']);
  });

  it('上限の数の URL だけを並べて取り、残りに要求を出さない', async () => {
    const requested: string[] = [];
    const fetcher: LinkPreviewFetcher = async (url) => {
      requested.push(url);
      return html(`<title>${url}</title>`);
    };

    const results = await fetchLinkPreviews(
      ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'],
      { fetcher, limits: LIMITS },
    );

    expect(results.map((r) => r.url)).toEqual(['https://example.com/1', 'https://example.com/2']);
    expect(requested.sort()).toEqual(['https://example.com/1', 'https://example.com/2']);
  });

  it('1 つが失敗しても、ほかの取得を返す', async () => {
    const fetcher: LinkPreviewFetcher = async (url) =>
      url.endsWith('/1') ? new Response('', { status: 500 }) : html('<title>取れた</title>');

    const results = await fetchLinkPreviews(['https://example.com/1', 'https://example.com/2'], {
      fetcher,
      limits: LIMITS,
    });

    expect(results).toEqual([
      { status: 'failed', url: 'https://example.com/1', reason: 'http' },
      { status: 'fetched', url: 'https://example.com/2', title: '取れた', imageUrl: null },
    ]);
  });

  it('本番の上限は plan.md の値（5 件・リダイレクト 2 段・3 秒・512 KiB）', () => {
    expect(LINK_PREVIEW_LIMITS).toEqual({
      maxUrls: 5,
      maxRedirects: 2,
      timeoutMs: 3000,
      maxBytes: 512 * 1024,
    });
  });
});
