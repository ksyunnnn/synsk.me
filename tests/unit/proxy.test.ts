import { NextRequest } from 'next/server';
import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `src/proxy.ts` が、描画の前に 404 と 403 の画面へ rewrite するかを確かめる。
 *
 * vinext 1.0.0-beta.9 は、ストリーミングを始めずに描画を終えるため、`proxy` がなくても
 * ページの `notFound()` と `forbidden()` で 404 と 403 になる。結合テストでは `proxy` が
 * 働いたかを見分けられないため、ここで判定そのものを確かめる。
 *
 * 経路の照合には Next.js 16.3.4 の `unstable_doesMiddlewareMatch` を使う。公式の文書は
 * `unstable_doesProxyMatch` と書くが、16.3.4 にはまだない
 */

const queries = vi.hoisted(() => ({
  isAuthorRequest: vi.fn<(headers: Headers) => Promise<boolean>>(),
  hasPublishedNote: vi.fn<(slug: string) => Promise<boolean>>(),
  hasEditableNote: vi.fn<(id: string) => Promise<boolean>>(),
  hasDeletedNote: vi.fn<(id: string) => Promise<boolean>>(),
}));
vi.mock('@/features/note/server/queries', () => queries);

const { config, proxy } = await import('@/proxy');

const request = (path: string, method = 'GET') =>
  new NextRequest(new URL(path, 'https://synsk.me'), { method });

/** rewrite 先の経路。rewrite しなければ null */
const rewrittenPath = async (path: string, method = 'GET') => {
  const response = await proxy(request(path, method));
  return isRewrite(response) ? new URL(getRewrittenUrl(response)!).pathname : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  queries.isAuthorRequest.mockResolvedValue(true);
  queries.hasPublishedNote.mockResolvedValue(true);
  queries.hasEditableNote.mockResolvedValue(true);
  queries.hasDeletedNote.mockResolvedValue(true);
});

describe('対象の経路', () => {
  it.each(['/notes/first-note', '/dash', '/dash/notes/new', '/dash/notes/1/restore'])(
    '%s で動く',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each(['/', '/notes/first-note/missing', '/opengraph-image'])('%s では動かない', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe('/notes/{slug}', () => {
  it('公開中の note は rewrite しない', async () => {
    expect(await rewrittenPath('/notes/first-note')).toBeNull();
    expect(queries.hasPublishedNote).toHaveBeenCalledWith('first-note');
  });

  it('公開中でなければ 404 の画面へ rewrite する', async () => {
    queries.hasPublishedNote.mockResolvedValue(false);
    expect(await rewrittenPath('/notes/draft')).toBe('/notes/draft/missing');
  });

  it('作り手かを確かめない', async () => {
    queries.isAuthorRequest.mockResolvedValue(false);
    expect(await rewrittenPath('/notes/first-note')).toBeNull();
    expect(queries.isAuthorRequest).not.toHaveBeenCalled();
  });
});

describe('/dash 配下', () => {
  it.each(['GET', 'POST'])('作り手でなければ %s を 403 の画面へ rewrite する', async (method) => {
    queries.isAuthorRequest.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/notes/1', method)).toBe('/dash/forbidden');
  });

  it.each(['/dash', '/dash/notes/new', '/dash/notes/1', '/dash/notes/1/delete'])(
    '作り手の %s は rewrite しない',
    async (path) => {
      expect(await rewrittenPath(path)).toBeNull();
    },
  );

  it.each(['/dash/notes/1', '/dash/notes/1/delete'])(
    '編集できる note がなければ %s を 404 の画面へ rewrite する',
    async (path) => {
      queries.hasEditableNote.mockResolvedValue(false);
      expect(await rewrittenPath(path)).toBe('/dash/notes/1/missing');
      expect(queries.hasEditableNote).toHaveBeenCalledWith('1');
    },
  );

  it('戻す確認の画面は、削除した note があるかで決める', async () => {
    queries.hasDeletedNote.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/notes/1/restore')).toBe('/dash/notes/1/missing');
    expect(queries.hasEditableNote).not.toHaveBeenCalled();
  });

  it('書き込みの操作は、note の有無で rewrite しない', async () => {
    queries.hasEditableNote.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/notes/1', 'POST')).toBeNull();
  });
});

describe('D1 から読み出せない', () => {
  it.each([
    ['/notes/first-note', queries.hasPublishedNote],
    ['/dash/notes/1', queries.hasEditableNote],
    ['/dash', queries.isAuthorRequest],
  ] as const)('%s は判定せずにページへ通す', async (path, query) => {
    query.mockRejectedValue(new Error('D1_ERROR'));
    expect(await rewrittenPath(path)).toBeNull();
  });
});
