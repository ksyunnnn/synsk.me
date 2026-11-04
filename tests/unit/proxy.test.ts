import { NextRequest } from 'next/server';
import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Author } from '@/shared/server/author';

/**
 * `src/proxy.ts` が、描画の前に 404 と 403 の画面へ rewrite するかと、`/dash` 配下の応答を
 * どのキャッシュにも残さない形にするかを確かめる。
 *
 * vinext は、HTML の要求ではストリーミングを始めずに描画を終えるため、`proxy` がなくても
 * ページの `notFound()` と `forbidden()` で 404 と 403 になる。結合テストでは `proxy` が働いたかを見分けられない
 * ため、ここで判定そのものを確かめる。
 *
 * 経路の照合には `unstable_doesMiddlewareMatch` を使う。公式の文書は
 * `unstable_doesProxyMatch` と書くが、Next.js 16.4.2 にはまだない
 */

const author = vi.hoisted(() => ({
  getAuthorFromHeaders: vi.fn<(headers: Headers) => Promise<Author | null>>(),
}));
vi.mock('@/shared/server/author', () => author);

const projects = vi.hoisted(() => ({
  hasProjectSlug: vi.fn<(slug: string) => Promise<boolean>>(),
  hasProjectId: vi.fn<(id: string) => Promise<boolean>>(),
}));
vi.mock('@/features/project/server/queries', () => projects);

/** 行の有無を見る、管理画面のコレクションごとの関数 */
const rows = vi.hoisted(() => ({
  hasOrganizationId: vi.fn<(id: string) => Promise<boolean>>(),
  hasSkillId: vi.fn<(id: string) => Promise<boolean>>(),
}));
vi.mock('@/features/organization/server/queries', () => ({
  hasOrganizationId: rows.hasOrganizationId,
}));
vi.mock('@/features/skill/server/queries', () => ({ hasSkillId: rows.hasSkillId }));

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
  projects.hasProjectSlug.mockResolvedValue(true);
  projects.hasProjectId.mockResolvedValue(true);
  for (const has of Object.values(rows)) has.mockResolvedValue(true);
});

describe('対象の経路', () => {
  it.each(['/projects/a-slug', '/dash', '/dash/projects', '/dash/projects/1/delete'])(
    '%s で動く',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each(['/', '/about', '/opengraph-image', '/dashboard', '/projects/a-slug/missing'])(
    '%s では動かない',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});

describe('/projects/{slug}', () => {
  it('ある識別子は rewrite しない', async () => {
    expect(await rewrittenPath('/projects/a-slug')).toBeNull();
    expect(projects.hasProjectSlug).toHaveBeenCalledWith('a-slug');
  });

  it('無い識別子は 404 の画面へ rewrite する', async () => {
    projects.hasProjectSlug.mockResolvedValue(false);
    expect(await rewrittenPath('/projects/no-such')).toBe('/projects/no-such/missing');
  });

  it('作り手かを確かめず、no-store を付けない', async () => {
    const response = await proxy(request('/projects/a-slug'));
    expect(author.getAuthorFromHeaders).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBeNull();
  });
});

describe('/dash/projects/{id}', () => {
  it.each(['/dash/projects/1', '/dash/projects/1/delete'])(
    '無い id の %s は 404 の画面へ rewrite する',
    async (path) => {
      projects.hasProjectId.mockResolvedValue(false);
      expect(await rewrittenPath(path)).toBe('/dash/projects/1/missing');
      expect(projects.hasProjectId).toHaveBeenCalledWith('1');
    },
  );

  it.each(['/dash/projects', '/dash/projects/new'])('%s は行の有無を見ない', async (path) => {
    projects.hasProjectId.mockResolvedValue(false);
    expect(await rewrittenPath(path)).toBeNull();
    expect(projects.hasProjectId).not.toHaveBeenCalled();
  });

  it('書き込みの操作は、行の有無で rewrite しない', async () => {
    projects.hasProjectId.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/projects/1', 'POST')).toBeNull();
  });

  it('作り手でなければ、行の有無より先に 403', async () => {
    author.getAuthorFromHeaders.mockResolvedValue(null);
    projects.hasProjectId.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/projects/1')).toBe('/dash/forbidden');
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
  it('D1 から実績の有無を読み出せなければ、判定せずにページへ通す', async () => {
    projects.hasProjectSlug.mockRejectedValue(new Error('D1_ERROR'));
    expect(await rewrittenPath('/projects/a-slug')).toBeNull();
  });

  it('D1 や設定値を読み出せなければ、判定せずにページへ通す', async () => {
    author.getAuthorFromHeaders.mockRejectedValue(new Error('D1_ERROR'));
    const response = await proxy(request('/dash'));
    expect(isRewrite(response)).toBe(false);
    expect(response.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });
});

describe.each([
  ['organizations', rows.hasOrganizationId],
  ['skills', rows.hasSkillId],
] as const)('/dash/%s/{id}', (collection, has) => {
  it('無い id は 404 の画面へ rewrite する', async () => {
    has.mockResolvedValue(false);
    expect(await rewrittenPath(`/dash/${collection}/5/delete`)).toBe(
      `/dash/${collection}/5/missing`,
    );
    expect(has).toHaveBeenCalledWith('5');
  });

  it('ある id は rewrite しない', async () => {
    expect(await rewrittenPath(`/dash/${collection}/5`)).toBeNull();
  });
});
