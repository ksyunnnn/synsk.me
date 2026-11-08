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
  hasCareerId: vi.fn<(id: string) => Promise<boolean>>(),
  hasEducationId: vi.fn<(id: string) => Promise<boolean>>(),
}));
vi.mock('@/features/organization/server/queries', () => ({
  hasOrganizationId: rows.hasOrganizationId,
}));
vi.mock('@/features/skill/server/queries', () => ({ hasSkillId: rows.hasSkillId }));
vi.mock('@/features/career/server/queries', () => ({ hasCareerId: rows.hasCareerId }));
vi.mock('@/features/education/server/queries', () => ({ hasEducationId: rows.hasEducationId }));

const resumes = vi.hoisted(() => ({
  hasVisitorResume: vi.fn<(slug: string) => Promise<boolean>>(),
  hasResumeId: vi.fn<(id: string) => Promise<boolean>>(),
  hasResumeRow: vi.fn<(id: string, kind: string, rowId: string) => Promise<boolean>>(),
}));
vi.mock('@/features/resume/server/queries', () => resumes);

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
  for (const has of Object.values(resumes)) has.mockResolvedValue(true);
});

describe('対象の経路', () => {
  it.each([
    '/projects/a-slug',
    '/resume/a-slug',
    '/dash',
    '/dash/projects',
    '/dash/projects/1/delete',
  ])('%s で動く', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

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
  ['careers', rows.hasCareerId],
  ['educations', rows.hasEducationId],
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

/**
 * 限定公開用の職務経歴書（specs/002-resume/research.md の R6・R7）。中身を返さない要求は
 * `/resume/{slug}/missing` へ移し、すべての応答に 3 つのヘッダを付ける（FR-015）
 */
describe('/resume/{slug}', () => {
  const SLUG = '146e2230-0e3f-4c88-815f-1d8ba698bf7d';
  const LIMITED_HEADERS = {
    'cache-control': 'no-store, must-revalidate',
    'x-robots-tag': 'noindex',
    'referrer-policy': 'no-referrer',
  };
  const expectLimitedHeaders = (response: Response) => {
    for (const [name, value] of Object.entries(LIMITED_HEADERS)) {
      expect(response.headers.get(name), name).toBe(value);
    }
  };

  it('中身を返してよい識別子は rewrite せず、3 つのヘッダを付ける', async () => {
    const response = await proxy(request(`/resume/${SLUG}`));
    expect(isRewrite(response)).toBe(false);
    expect(resumes.hasVisitorResume).toHaveBeenCalledWith(SLUG);
    expectLimitedHeaders(response);
  });

  it('下書き・期限切れ・無い識別子は 404 の画面へ rewrite し、3 つのヘッダを付ける', async () => {
    resumes.hasVisitorResume.mockResolvedValue(false);
    const response = await proxy(request(`/resume/${SLUG}`));
    expect(new URL(getRewrittenUrl(response)!).pathname).toBe(`/resume/${SLUG}/missing`);
    expectLimitedHeaders(response);
  });

  it('判定できないときは通し、3 つのヘッダを付ける', async () => {
    resumes.hasVisitorResume.mockRejectedValue(new Error('D1_ERROR'));
    const response = await proxy(request(`/resume/${SLUG}`));
    expect(isRewrite(response)).toBe(false);
    expectLimitedHeaders(response);
  });

  it('作り手かを確かめない', async () => {
    await proxy(request(`/resume/${SLUG}`));
    expect(author.getAuthorFromHeaders).not.toHaveBeenCalled();
  });

  it('書き込みの要求は判定しない', async () => {
    expect(await rewrittenPath(`/resume/${SLUG}`, 'POST')).toBeNull();
    expect(resumes.hasVisitorResume).not.toHaveBeenCalled();
  });

  it('/resume/{slug} の下の経路は判定せず、3 つのヘッダを付ける', async () => {
    resumes.hasVisitorResume.mockResolvedValue(false);
    for (const path of [`/resume/${SLUG}/missing`, `/resume/${SLUG}/a-key`]) {
      const response = await proxy(request(path));
      expect(isRewrite(response), path).toBe(false);
      expectLimitedHeaders(response);
    }
    expect(resumes.hasVisitorResume).not.toHaveBeenCalled();
  });

  it('/resume は判定せず、ヘッダも付けない', async () => {
    const response = await proxy(request('/resume'));
    expect(isRewrite(response)).toBe(false);
    expect(resumes.hasVisitorResume).not.toHaveBeenCalled();
    expect(response.headers.get('x-robots-tag')).toBeNull();
  });
});

describe('/dash/resumes/{id}/<種類>/{rowId}（specs/002-resume/contracts/dash.md）', () => {
  it('無い職務経歴書は、職務経歴書の 404 の画面へ rewrite する', async () => {
    resumes.hasResumeId.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/resumes/3/careers/7')).toBe('/dash/resumes/3/missing');
  });

  it.each(['careers', 'projects', 'educations'])(
    '無い %s の行は、行の 404 の画面へ rewrite する',
    async (kind) => {
      resumes.hasResumeRow.mockResolvedValue(false);
      expect(await rewrittenPath(`/dash/resumes/3/${kind}/7`)).toBe(
        `/dash/resumes/3/${kind}/7/missing`,
      );
      expect(resumes.hasResumeRow).toHaveBeenCalledWith('3', kind, '7');
    },
  );

  it('ある行は rewrite しない', async () => {
    expect(await rewrittenPath('/dash/resumes/3/projects/7')).toBeNull();
  });

  it.each([
    '/dash/resumes/3/skills',
    '/dash/resumes/3/preview',
    '/dash/resumes/3/projects/7/missing',
  ])('%s は行の有無を見ない', async (path) => {
    resumes.hasResumeRow.mockResolvedValue(false);
    expect(await rewrittenPath(path)).toBeNull();
    expect(resumes.hasResumeRow).not.toHaveBeenCalled();
  });

  it('無い職務経歴書の id は 404 の画面へ rewrite する', async () => {
    resumes.hasResumeId.mockResolvedValue(false);
    expect(await rewrittenPath('/dash/resumes/3')).toBe('/dash/resumes/3/missing');
  });
});
