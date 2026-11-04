import { NextRequest } from 'next/server';
import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Author } from '@/shared/server/author';

/**
 * `src/proxy.ts` が、描画の前に 403 の画面へ rewrite するかと、`/dash` 配下の応答を
 * どのキャッシュにも残さない形にするかを確かめる。
 *
 * vinext は、HTML の要求ではストリーミングを始めずに描画を終えるため、`proxy` がなくても
 * ページの `forbidden()` で 403 になる。結合テストでは `proxy` が働いたかを見分けられない
 * ため、ここで判定そのものを確かめる。
 *
 * 経路の照合には `unstable_doesMiddlewareMatch` を使う。公式の文書は
 * `unstable_doesProxyMatch` と書くが、Next.js 16.4.2 にはまだない
 */

const author = vi.hoisted(() => ({
  getAuthorFromHeaders: vi.fn<(headers: Headers) => Promise<Author | null>>(),
}));
vi.mock('@/shared/server/author', () => author);

const { config, proxy } = await import('@/proxy');

const OWNER: Author = { email: 'owner@synsk.test' };

const request = (path: string, method = 'GET') =>
  new NextRequest(new URL(path, 'https://synsk.me'), { method });

/** rewrite 先の経路。rewrite しなければ null */
const rewrittenPath = async (path: string, method = 'GET') => {
  const response = await proxy(request(path, method));
  return isRewrite(response) ? new URL(getRewrittenUrl(response)!).pathname : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  author.getAuthorFromHeaders.mockResolvedValue(OWNER);
});

describe('対象の経路', () => {
  it.each(['/dash', '/dash/projects', '/dash/projects/1/delete'])('%s で動く', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(['/', '/about', '/opengraph-image', '/dashboard'])('%s では動かない', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe('/dash 配下', () => {
  it.each(['GET', 'POST'])('作り手でなければ %s を 403 の画面へ rewrite する', async (method) => {
    author.getAuthorFromHeaders.mockResolvedValue(null);
    expect(await rewrittenPath('/dash/projects', method)).toBe('/dash/forbidden');
  });

  it.each(['/dash', '/dash/projects', '/dash/projects/1'])(
    '作り手の %s は rewrite しない',
    async (path) => {
      expect(await rewrittenPath(path)).toBeNull();
    },
  );

  it('要求のヘッダで作り手を確かめる', async () => {
    const req = request('/dash');
    await proxy(req);
    expect(author.getAuthorFromHeaders).toHaveBeenCalledWith(req.headers);
  });

  it.each([
    ['作り手', OWNER],
    ['作り手でない', null],
  ])('%s の応答は、どのキャッシュにも残さない', async (_, who) => {
    author.getAuthorFromHeaders.mockResolvedValue(who);
    const response = await proxy(request('/dash/projects'));
    expect(response.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });
});

describe('作り手を確かめられない', () => {
  it('D1 や設定値を読み出せなければ、判定せずにページへ通す', async () => {
    author.getAuthorFromHeaders.mockRejectedValue(new Error('D1_ERROR'));
    const response = await proxy(request('/dash'));
    expect(isRewrite(response)).toBe(false);
    expect(response.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });
});
