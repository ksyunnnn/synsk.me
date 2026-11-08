import { describe, expect, it, vi } from 'vitest';
import {
  MAX_RESPONSE_CHARS,
  USER_AGENT,
  checkUrl,
  getText,
  type Http,
} from '@/features/activity/server/sources/http';
import { LIST_FETCHERS } from '@/features/activity/server/sources/list-sources';
import { readRssItems } from '@/features/activity/server/sources/rss';
import { fetchRegisteredItem } from '@/features/activity/server/sources/url-sources';

/**
 * 取得元ごとの取り方が、外部の応答を `FetchedItem` に詰め替えること
 * （specs/004-external-activity/spec.md の FR-006・FR-007、research.md の R4・R9）。
 *
 * 外部のサービスを叩かない。応答は PR #47 の検証記録（2026-09-02 実測）のフィールドの形に
 * 合わせた作り物で、題・URL・ID はすべて作り物
 */

/** 要求の URL ごとに、固定した応答を返す `fetch` */
const fakeHttp = (responses: Record<string, () => Response>): Http & { calls: string[] } => {
  const calls: string[] = [];
  const http = vi.fn(async (url: string) => {
    calls.push(url);
    const respond = responses[url];
    if (!respond) throw new Error(`作り物の応答が無い: ${url}`);
    return respond();
  });
  return Object.assign(http, { calls });
};

const xml = (body: string) => () =>
  new Response(body, { headers: { 'content-type': 'application/rss+xml' } });
const json =
  (body: unknown, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', ...headers },
    });

const ENV = {};

describe('readRssItems', () => {
  it('CDATA と文字参照を戻し、自分で閉じる要素の属性を読む', () => {
    const [item] = readRssItems(
      `<rss><channel><link>https://example.com/</link><item>
        <title><![CDATA[作り物 & 記事]]></title>
        <link>https://example.com/a?x=1&amp;y=2</link>
        <enclosure url="https://example.com/a.png" length="0" type="image/png"/>
      </item></channel></rss>`,
    );
    expect(item.text('title')).toBe('作り物 & 記事');
    expect(item.text('link')).toBe('https://example.com/a?x=1&y=2');
    expect(item.attribute('enclosure', 'url')).toBe('https://example.com/a.png');
    expect(item.text('guid')).toBeNull();
  });
});

describe('一覧を取る取得元', () => {
  it('Zenn は RSS を詰め替え、ID を持たず、一覧をすべての項目とみなさない', async () => {
    const http = fakeHttp({
      'https://zenn.dev/ksyunnnn/feed': xml(`<rss><channel>
        <item>
          <title><![CDATA[作り物の記事 A]]></title>
          <link>https://zenn.dev/ksyunnnn/articles/fake-a</link>
          <guid isPermaLink="true">https://zenn.dev/ksyunnnn/articles/fake-a</guid>
          <pubDate>Tue, 09 Sep 2025 08:02:10 GMT</pubDate>
          <enclosure url="https://res.cloudinary.com/fake/a.png" length="0" type="image/png"/>
        </item>
        <item><title></title><link>https://zenn.dev/ksyunnnn/articles/fake-b</link><pubDate>Tue, 09 Sep 2025 08:02:10 GMT</pubDate></item>
      </channel></rss>`),
    });
    expect(await LIST_FETCHERS.zenn_article(http, ENV)).toEqual({
      ok: true,
      items: [
        {
          externalId: null,
          url: 'https://zenn.dev/ksyunnnn/articles/fake-a',
          title: '作り物の記事 A',
          publishedAt: '2025-09-09T08:02:10.000Z',
          imageUrl: 'https://res.cloudinary.com/fake/a.png',
        },
      ],
      isComplete: false,
      // 題の無い項目は保存しない
      skipped: 1,
    });
  });

  it('Medium は guid を ID にし、link の問い合わせを外し、本文の最初の画像を使う', async () => {
    const http = fakeHttp({
      'https://medium.com/feed/@ksyunnnn': xml(`<rss><channel><item>
        <title><![CDATA[作り物の振り返り]]></title>
        <link>https://medium.com/fake/post-1?source=rss-fake</link>
        <guid isPermaLink="false">https://medium.com/p/fake1</guid>
        <pubDate>Sun, 03 Jan 2021 12:13:20 GMT</pubDate>
        <content:encoded><![CDATA[<p>本文</p><img alt="" src="https://cdn-images.example/1.png"><img src="https://cdn-images.example/2.png">]]></content:encoded>
      </item></channel></rss>`),
    });
    const outcome = await LIST_FETCHERS.medium_article(http, ENV);
    expect(outcome).toMatchObject({
      ok: true,
      isComplete: false,
      items: [
        {
          externalId: 'https://medium.com/p/fake1',
          url: 'https://medium.com/fake/post-1',
          imageUrl: 'https://cdn-images.example/1.png',
        },
      ],
    });
  });

  it('Speaker Deck は media:content を代表の画像にし、オフセット付きの日時を UTC にする', async () => {
    const http = fakeHttp({
      'https://speakerdeck.com/ksyunnnn.rss': xml(`<rss><channel><item>
        <title>作り物の登壇</title>
        <link>https://speakerdeck.com/ksyunnnn/fake-talk</link>
        <pubDate>Fri, 13 Sep 2019 00:00:00 -0400</pubDate>
        <media:content url="https://files.speakerdeck.com/fake.jpg?1"/>
      </item></channel></rss>`),
    });
    expect(await LIST_FETCHERS.speakerdeck_deck(http, ENV)).toMatchObject({
      ok: true,
      items: [
        {
          publishedAt: '2019-09-13T04:00:00.000Z',
          imageUrl: 'https://files.speakerdeck.com/fake.jpg?1',
        },
      ],
    });
  });

  it('Qiita は id を ID にし、total-count が返った件数以下ならすべての項目とみなす', async () => {
    const http = fakeHttp({
      'https://qiita.com/api/v2/users/ksyunnnn/items?per_page=100&page=1': json(
        [
          {
            id: 'fake0001',
            title: '作り物の設定メモ',
            url: 'https://qiita.com/ksyunnnn/items/fake0001',
            created_at: '2022-05-19T10:20:46+09:00',
          },
        ],
        { 'total-count': '1' },
      ),
    });
    expect(await LIST_FETCHERS.qiita_article(http, ENV)).toEqual({
      ok: true,
      items: [
        {
          externalId: 'fake0001',
          url: 'https://qiita.com/ksyunnnn/items/fake0001',
          title: '作り物の設定メモ',
          publishedAt: '2022-05-19T01:20:46.000Z',
          imageUrl: null,
        },
      ],
      isComplete: true,
      skipped: 0,
    });
  });

  it('Qiita のトークンがあれば Authorization に付ける', async () => {
    const http = fakeHttp({
      'https://qiita.com/api/v2/users/ksyunnnn/items?per_page=100&page=1': json([], {
        'total-count': '0',
      }),
    });
    await LIST_FETCHERS.qiita_article(http, { QIITA_ACCESS_TOKEN: 'fake-token' });
    expect(http).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer fake-token' }),
      }),
    );
  });

  it('dev.to は User-Agent を付け、数の id を文字列の ID にし、cover_image が無ければ social_image を使う', async () => {
    const http = fakeHttp({
      'https://dev.to/api/articles?username=ksyunnnn&per_page=100': json([
        {
          id: 1715490,
          title: 'Fake memo',
          url: 'https://dev.to/ksyunnnn/fake-memo',
          published_at: '2024-01-03T05:48:34Z',
          cover_image: null,
          social_image: 'https://media2.dev.to/fake.png',
        },
      ]),
    });
    expect(await LIST_FETCHERS.devto_article(http, ENV)).toMatchObject({
      ok: true,
      isComplete: true,
      items: [{ externalId: '1715490', imageUrl: 'https://media2.dev.to/fake.png' }],
    });
    expect(http).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ 'user-agent': USER_AGENT }) }),
    );
  });

  it('GitHub はフォークしたリポジトリを取り込まず、作った日を公開日にする', async () => {
    const http = fakeHttp({
      'https://api.github.com/users/ksyunnnn/repos?type=owner&sort=created&direction=desc&per_page=100':
        json([
          {
            id: 1,
            name: 'fake-repo',
            html_url: 'https://github.com/ksyunnnn/fake-repo',
            created_at: '2022-11-26T00:00:00Z',
            pushed_at: null,
            fork: false,
          },
          {
            id: 2,
            name: 'forked',
            html_url: 'https://github.com/ksyunnnn/forked',
            created_at: '2023-01-01T00:00:00Z',
            fork: true,
          },
        ]),
    });
    expect(await LIST_FETCHERS.github_repository(http, ENV)).toMatchObject({
      ok: true,
      items: [{ externalId: '1', title: 'fake-repo', publishedAt: '2022-11-26T00:00:00.000Z' }],
    });
  });

  it('connpass は API キーが無ければ要求を出さずに失敗を返す', async () => {
    const http = fakeHttp({});
    expect(await LIST_FETCHERS.connpass_event(http, ENV)).toEqual({
      ok: false,
      reason: 'API キー（CONNPASS_API_KEY）が無い',
    });
    expect(http.calls).toEqual([]);
  });

  it('connpass は API キーをヘッダに付け、results_available ですべての項目かを決める', async () => {
    const http = fakeHttp({
      'https://connpass.com/api/v2/users/ksyunnnn/attended_events/?count=100': json({
        results_available: 3,
        results_returned: 1,
        events: [
          {
            id: 144496,
            title: '作り物の勉強会',
            url: 'https://fake.connpass.com/event/144496/',
            started_at: '2019-09-13T19:00:00+09:00',
          },
        ],
      }),
    });
    expect(
      await LIST_FETCHERS.connpass_event(http, { CONNPASS_API_KEY: 'fake-key' }),
    ).toMatchObject({ ok: true, isComplete: false, items: [{ externalId: '144496' }] });
    expect(http).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'fake-key' }) }),
    );
  });

  it('応答が一覧の形でなければ失敗を返す', async () => {
    const http = fakeHttp({
      'https://dev.to/api/articles?username=ksyunnnn&per_page=100': json({ error: 'fake' }),
    });
    expect(await LIST_FETCHERS.devto_article(http, ENV)).toEqual({
      ok: false,
      reason: '応答が一覧の形でない',
    });
  });
});

describe('getText（失敗の表し方）', () => {
  it('2xx でない状態を、投げずに理由と状態で返す', async () => {
    const http = fakeHttp({ 'https://example.com/': () => new Response('', { status: 503 }) });
    expect(await getText(http, 'https://example.com/')).toEqual({
      ok: false,
      reason: '状態 503 を返した',
      status: 503,
    });
  });

  it('待ち時間切れを、投げずに理由で返す', async () => {
    const http: Http = async () => {
      throw new DOMException('timed out', 'TimeoutError');
    };
    expect(await getText(http, 'https://example.com/')).toEqual({
      ok: false,
      reason: '10 秒で応答が無い',
      status: null,
    });
  });

  it('大きすぎる応答を読まない', async () => {
    const http = fakeHttp({
      'https://example.com/': () => new Response('x'.repeat(MAX_RESPONSE_CHARS + 1)),
    });
    expect(await getText(http, 'https://example.com/')).toMatchObject({
      ok: false,
      reason: '応答が大きすぎる',
    });
  });
});

describe('checkUrl', () => {
  it.each([
    [404, 'gone'],
    [410, 'gone'],
    [200, 'present'],
    [301, 'present'],
    [403, 'unknown'],
    [500, 'unknown'],
  ] as const)('状態 %i は %s', async (status, expected) => {
    const http = fakeHttp({
      'https://example.com/a': () => new Response(null, { status }),
    });
    expect(await checkUrl(http, 'https://example.com/a')).toBe(expected);
  });

  it('通信の失敗は unknown', async () => {
    const http: Http = async () => {
      throw new TypeError('fake network error');
    };
    expect(await checkUrl(http, 'https://example.com/a')).toBe('unknown');
  });
});

describe('URL を指名する取得元', () => {
  it('Spotify は oEmbed の題と画像を取る', async () => {
    const url = 'https://open.spotify.com/playlist/fake123';
    const http = fakeHttp({
      [`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`]: json({
        title: '作り物のプレイリスト',
        thumbnail_url: 'https://mosaic.scdn.co/300/fake',
      }),
    });
    expect(await fetchRegisteredItem(http, 'spotify_playlist', url)).toEqual({
      ok: true,
      title: '作り物のプレイリスト',
      imageUrl: 'https://mosaic.scdn.co/300/fake',
    });
  });

  it('X は投稿の本文を題にする', async () => {
    const url = 'https://x.com/ksyunnnn/status/1';
    const http = fakeHttp({
      [`https://publish.x.com/oembed?url=${encodeURIComponent(url)}&omit_script=1`]: json({
        html: '<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">作り物の<br>投稿 <a href="https://t.co/x">pic</a></p>&mdash; 作り物</blockquote>',
      }),
    });
    expect(await fetchRegisteredItem(http, 'x_post', url)).toEqual({
      ok: true,
      title: '作り物の 投稿 pic',
      imageUrl: null,
    });
  });

  it('題を返さなければ、保存できない理由を返す（research.md の R9）', async () => {
    const url = 'https://www.youtube.com/watch?v=fakeVideo01';
    const http = fakeHttp({
      [`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`]: json({
        title: '',
      }),
    });
    expect(await fetchRegisteredItem(http, 'youtube_video', url)).toEqual({
      ok: false,
      reason: '取得元が題を返さなかった',
      gone: false,
    });
  });

  it('404 は取得元で消えたとして返す', async () => {
    const url = 'https://www.youtube.com/watch?v=fakeVideo01';
    const http = fakeHttp({
      [`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`]: () =>
        new Response('', { status: 404 }),
    });
    expect(await fetchRegisteredItem(http, 'youtube_video', url)).toMatchObject({
      ok: false,
      gone: true,
    });
  });

  it('CodeSandbox は og:title の末尾を外し、既定の題なら取れないとする', async () => {
    const http = fakeHttp({
      'https://codesandbox.io/embed/fake-a': () =>
        new Response('<meta property="og:title" content="作り物の sandbox - CodeSandbox">'),
      'https://codesandbox.io/embed/fake-b': () =>
        new Response('<meta property="og:title" content="CodeSandbox">'),
    });
    expect(
      await fetchRegisteredItem(http, 'codesandbox_sandbox', 'https://codesandbox.io/s/fake-a'),
    ).toEqual({ ok: true, title: '作り物の sandbox', imageUrl: null });
    expect(
      await fetchRegisteredItem(http, 'codesandbox_sandbox', 'https://codesandbox.io/s/fake-b'),
    ).toMatchObject({ ok: false, gone: false });
  });
});
