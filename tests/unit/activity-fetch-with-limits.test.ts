import { describe, expect, it } from 'vitest';
import { createSourceHttp } from '@/features/activity/server/sources/fetch-with-limits';
import type { FetchLimits } from '@/features/activity/domain/limits';

/**
 * 取得元への要求にかける上限（specs/004-external-activity/research.md の R8、contracts/fetch.md）。
 * 外へ要求を出さず、作り物の応答を返す `fetcher` を渡す
 */

const LIMITS: FetchLimits = { maxRequests: 2, timeoutMs: 50, maxBytes: 16 };

describe('createSourceHttp', () => {
  it('User-Agent を付けて要求し、本文を返す', async () => {
    const seen: Headers[] = [];
    const http = createSourceHttp(async (_url, init) => {
      seen.push(new Headers(init?.headers));
      return new Response('作り物', { status: 200 });
    }, LIMITS);

    const response = await http.get('https://example.com/feed', { 'X-Fake': '1' });

    expect(response.text).toBe('作り物');
    expect(seen[0]?.get('User-Agent')).toBe('synsk.me (+https://synsk.me)');
    expect(seen[0]?.get('X-Fake')).toBe('1');
  });

  it('リダイレクトで別のホストへ移った応答は読まずに失敗にする（R10）', async () => {
    const http = createSourceHttp(async () => {
      const response = new Response('別のホスト', { status: 200 });
      Object.defineProperty(response, 'redirected', { value: true });
      Object.defineProperty(response, 'url', { value: 'https://other.example/x' });
      return response;
    }, LIMITS);

    await expect(http.get('https://example.com/feed')).rejects.toThrow(/別のホスト/);
  });

  it('別のホストへのリダイレクトは、移った先へ要求を出さずに失敗にする（R10）', async () => {
    const seen: string[] = [];
    const http = createSourceHttp(async (url) => {
      seen.push(url);
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://other.example/x' },
      });
    }, LIMITS);

    await expect(http.get('https://example.com/feed', { 'X-API-Key': 'fake' })).rejects.toThrow(
      /別のホスト/,
    );
    expect(seen).toEqual(['https://example.com/feed']);
  });

  it('同じホストへのリダイレクトは辿り、ヘッダを付け直して要求する', async () => {
    const seen: { url: string; key: string | null }[] = [];
    const http = createSourceHttp(async (url, init) => {
      seen.push({ url, key: new Headers(init?.headers).get('X-API-Key') });
      if (url.endsWith('/old')) {
        return new Response(null, { status: 301, headers: { Location: '/new' } });
      }
      return new Response('移った先');
    }, LIMITS);

    const response = await http.get('https://example.com/old', { 'X-API-Key': 'fake' });

    expect(response.text).toBe('移った先');
    expect(seen).toEqual([
      { url: 'https://example.com/old', key: 'fake' },
      { url: 'https://example.com/new', key: 'fake' },
    ]);
  });

  it('followRedirects が false なら辿らず、3xx を 2xx でない応答として扱う', async () => {
    const seen: string[] = [];
    const http = createSourceHttp(
      async (url) => {
        seen.push(url);
        return new Response(null, { status: 301, headers: { Location: '/new' } });
      },
      LIMITS,
      { followRedirects: false },
    );

    await expect(http.get('https://example.com/old')).rejects.toThrow(/HTTP 301/);
    expect(seen).toEqual(['https://example.com/old']);
  });

  it('要求の数が上限に達したら、要求を出さずに失敗する', async () => {
    let calls = 0;
    const http = createSourceHttp(async () => {
      calls += 1;
      return new Response('ok');
    }, LIMITS);

    await http.get('https://example.com/1');
    await http.get('https://example.com/2');

    expect(http.remaining).toBe(0);
    await expect(http.get('https://example.com/3')).rejects.toThrow(/要求の数の上限/);
    expect(calls).toBe(2);
  });

  it('待ち時間を超えたら失敗にする。応答しない fetcher でも待ち続けない', async () => {
    const http = createSourceHttp(() => new Promise<Response>(() => {}), LIMITS);

    await expect(http.get('https://example.com/slow')).rejects.toThrow(/待ち時間/);
  });

  it('応答の大きさが上限を超えたら失敗にする', async () => {
    const http = createSourceHttp(async () => new Response('x'.repeat(17)), LIMITS);

    await expect(http.get('https://example.com/large')).rejects.toThrow(/大きさ/);
  });

  it('Content-Length が上限を超えていたら、本文を読まずに失敗にする', async () => {
    let pulled = false;
    const body = new ReadableStream(
      {
        pull(controller) {
          pulled = true;
          controller.enqueue(new TextEncoder().encode('x'));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const http = createSourceHttp(
      async () => new Response(body, { headers: { 'Content-Length': '1000' } }),
      LIMITS,
    );

    await expect(http.get('https://example.com/large')).rejects.toThrow(/大きさ/);
    expect(pulled).toBe(false);
  });

  it('2xx でない応答は失敗にし、状態の値を理由に含める', async () => {
    const http = createSourceHttp(async () => new Response('', { status: 503 }), LIMITS);

    await expect(http.get('https://example.com/down')).rejects.toThrow(/503/);
  });
});
