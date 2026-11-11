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
  hasProjectUid: vi.fn<(uid: string) => Promise<boolean>>(),
}));
vi.mock('@/features/project/server/queries', () => projects);

/** 行の有無を見る、管理画面のコレクションごとの関数 */
const rows = vi.hoisted(() => ({
  hasOrganizationUid: vi.fn<(uid: string) => Promise<boolean>>(),
  hasSkillUid: vi.fn<(uid: string) => Promise<boolean>>(),
  hasCareerUid: vi.fn<(uid: string) => Promise<boolean>>(),
  hasEducationUid: vi.fn<(uid: string) => Promise<boolean>>(),
}));
vi.mock('@/features/organization/server/queries', () => ({
  hasOrganizationUid: rows.hasOrganizationUid,
}));
vi.mock('@/features/skill/server/queries', () => ({ hasSkillUid: rows.hasSkillUid }));
vi.mock('@/features/career/server/queries', () => ({ hasCareerUid: rows.hasCareerUid }));
vi.mock('@/features/education/server/queries', () => ({ hasEducationUid: rows.hasEducationUid }));

const resumes = vi.hoisted(() => ({
  hasVisitorResume: vi.fn<(slug: string) => Promise<boolean>>(),
  hasResumeUid: vi.fn<(uid: string) => Promise<boolean>>(),
  findMissingResumeRow:
    vi.fn<(uid: string, kind: string, rowUid: string) => Promise<'resume' | 'row' | null>>(),
}));
vi.mock('@/features/resume/server/queries', () => resumes);

const lifeEvents = vi.hoisted(() => ({
  hasLifeEventSlug: vi.fn<(slug: string) => Promise<boolean>>(),
  hasLifeEventUid: vi.fn<(uid: string) => Promise<boolean>>(),
  hasExternalActivityUid: vi.fn<(uid: string) => Promise<boolean>>(),
}));
vi.mock('@/features/activity/server/queries', () => lifeEvents);
const notes = vi.hoisted(() => ({
  hasNoteSlug: vi.fn<(slug: string) => Promise<boolean>>(),
  hasNoteUid: vi.fn<(uid: string) => Promise<boolean>>(),
  findMissingNoteRevision:
    vi.fn<(uid: string, revisionUid: string) => Promise<'note' | 'revision' | null>>(),
}));
vi.mock('@/features/note/server/queries', () => notes);

const { config, proxy } = await import('@/proxy');

/** 管理画面の URL の識別子（作り物の uid） */
const UID = '0123456789abcdef0123456789abcdef';
const ROW_UID = 'fedcba9876543210fedcba9876543210';

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
  projects.hasProjectUid.mockResolvedValue(true);
  for (const has of Object.values(rows)) has.mockResolvedValue(true);
  resumes.hasVisitorResume.mockResolvedValue(true);
  resumes.hasResumeUid.mockResolvedValue(true);
  resumes.findMissingResumeRow.mockResolvedValue(null);
  lifeEvents.hasLifeEventSlug.mockResolvedValue(true);
  lifeEvents.hasLifeEventUid.mockResolvedValue(true);
  lifeEvents.hasExternalActivityUid.mockResolvedValue(true);
  notes.hasNoteSlug.mockResolvedValue(true);
  notes.hasNoteUid.mockResolvedValue(true);
  notes.findMissingNoteRevision.mockResolvedValue(null);
});

describe('対象の経路', () => {
  it.each([
    '/projects/a-slug',
    '/life-events/a-slug',
    '/resume/a-slug',
    '/notes/a-slug',
    '/dash',
    '/dash/projects',
    `/dash/projects/${UID}/delete`,
  ])('%s で動く', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each([
    '/',
    '/about',
    '/opengraph-image',
    '/dashboard',
    '/projects/a-slug/missing',
    '/life-events/a-slug/missing',
    '/notes/a-slug/missing',
  ])('%s では動かない', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
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

  it('オーナーかを確かめず、no-store を付けない', async () => {
    const response = await proxy(request('/projects/a-slug'));
    expect(author.getAuthorFromHeaders).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBeNull();
  });
});

describe('/dash/projects/{uid}', () => {
  it.each([`/dash/projects/${UID}`, `/dash/projects/${UID}/delete`])(
    '無い id の %s は 404 の画面へ rewrite する',
    async (path) => {
      projects.hasProjectUid.mockResolvedValue(false);
      expect(await rewrittenPath(path)).toBe(`/dash/projects/${UID}/missing`);
      expect(projects.hasProjectUid).toHaveBeenCalledWith(UID);
    },
  );

  it.each(['/dash/projects', '/dash/projects/new'])('%s は行の有無を見ない', async (path) => {
    projects.hasProjectUid.mockResolvedValue(false);
    expect(await rewrittenPath(path)).toBeNull();
    expect(projects.hasProjectUid).not.toHaveBeenCalled();
  });

  it('書き込みの操作は、行の有無で rewrite しない', async () => {
    projects.hasProjectUid.mockResolvedValue(false);
    expect(await rewrittenPath(`/dash/projects/${UID}`, 'POST')).toBeNull();
  });

  it('オーナーでなければ、行の有無より先に 403', async () => {
    author.getAuthorFromHeaders.mockResolvedValue(null);
    projects.hasProjectUid.mockResolvedValue(false);
    expect(await rewrittenPath(`/dash/projects/${UID}`)).toBe('/dash/forbidden');
  });
});

describe('/dash 配下', () => {
  it.each(['GET', 'POST'])('オーナーでなければ %s を 403 の画面へ rewrite する', async (method) => {
    author.getAuthorFromHeaders.mockResolvedValue(null);
    expect(await rewrittenPath('/dash/projects', method)).toBe('/dash/forbidden');
  });

  it.each(['/dash', '/dash/projects', `/dash/projects/${UID}`])(
    'オーナーの %s は rewrite しない',
    async (path) => {
      expect(await rewrittenPath(path)).toBeNull();
    },
  );

  it('要求のヘッダでオーナーを確かめる', async () => {
    const req = request('/dash');
    await proxy(req);
    expect(author.getAuthorFromHeaders).toHaveBeenCalledWith(req.headers);
  });

  it.each([
    ['オーナー', OWNER],
    ['オーナーでない', null],
  ])('%s の応答は、どのキャッシュにも残さない', async (_, who) => {
    author.getAuthorFromHeaders.mockResolvedValue(who);
    const response = await proxy(request('/dash/projects'));
    expect(response.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });
});

describe('オーナーを確かめられない', () => {
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
  ['organizations', rows.hasOrganizationUid],
  ['skills', rows.hasSkillUid],
  ['careers', rows.hasCareerUid],
  ['educations', rows.hasEducationUid],
  ['notes', notes.hasNoteUid],
] as const)('/dash/%s/{uid}', (collection, has) => {
  it('無い uid は 404 の画面へ rewrite する', async () => {
    has.mockResolvedValue(false);
    expect(await rewrittenPath(`/dash/${collection}/${UID}/delete`)).toBe(
      `/dash/${collection}/${UID}/missing`,
    );
    expect(has).toHaveBeenCalledWith(UID);
  });

  it('ある uid は rewrite しない', async () => {
    expect(await rewrittenPath(`/dash/${collection}/${UID}`)).toBeNull();
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

  it('オーナーかを確かめない', async () => {
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

describe('/dash/resumes/{uid}/<種類>/{rowUid}（specs/002-resume/contracts/dash.md）', () => {
  it('足す画面（/dash/resumes/{uid}/<種類>/new）も、無い職務経歴書は 404 の画面へ rewrite する', async () => {
    resumes.hasResumeUid.mockResolvedValue(false);
    expect(await rewrittenPath(`/dash/resumes/${UID}/careers/new`)).toBe(
      `/dash/resumes/${UID}/missing`,
    );
  });

  it('無い職務経歴書は、職務経歴書の 404 の画面へ rewrite する', async () => {
    resumes.findMissingResumeRow.mockResolvedValue('resume');
    expect(await rewrittenPath(`/dash/resumes/${UID}/careers/${ROW_UID}`)).toBe(
      `/dash/resumes/${UID}/missing`,
    );
  });

  it('職務経歴書の有無を、行の有無と別に問い合わせない', async () => {
    await rewrittenPath(`/dash/resumes/${UID}/careers/${ROW_UID}`);
    expect(resumes.hasResumeUid).not.toHaveBeenCalled();
    expect(resumes.findMissingResumeRow).toHaveBeenCalledTimes(1);
  });

  it.each(['careers', 'projects', 'educations'])(
    '無い %s の行は、行の 404 の画面へ rewrite する',
    async (kind) => {
      resumes.findMissingResumeRow.mockResolvedValue('row');
      expect(await rewrittenPath(`/dash/resumes/${UID}/${kind}/${ROW_UID}`)).toBe(
        `/dash/resumes/${UID}/${kind}/${ROW_UID}/missing`,
      );
      expect(resumes.findMissingResumeRow).toHaveBeenCalledWith(UID, kind, ROW_UID);
    },
  );

  it('ある行は rewrite しない', async () => {
    expect(await rewrittenPath(`/dash/resumes/${UID}/projects/${ROW_UID}`)).toBeNull();
  });

  it.each([
    `/dash/resumes/${UID}/skills`,
    `/dash/resumes/${UID}/preview`,
    `/dash/resumes/${UID}/projects/${ROW_UID}/missing`,
    `/dash/resumes/${UID}/careers/new`,
    `/dash/resumes/${UID}/projects/new`,
    `/dash/resumes/${UID}/educations/new`,
  ])('%s は行の有無を見ない', async (path) => {
    resumes.findMissingResumeRow.mockResolvedValue('row');
    expect(await rewrittenPath(path)).toBeNull();
    expect(resumes.findMissingResumeRow).not.toHaveBeenCalled();
  });

  it('無い職務経歴書の uid は 404 の画面へ rewrite する', async () => {
    resumes.hasResumeUid.mockResolvedValue(false);
    expect(await rewrittenPath(`/dash/resumes/${UID}`)).toBe(`/dash/resumes/${UID}/missing`);
  });
});

describe('/life-events/{slug}（specs/004-external-activity/contracts/visitor-life-event.md）', () => {
  it('ある識別子は rewrite しない', async () => {
    expect(await rewrittenPath('/life-events/a-slug')).toBeNull();
    expect(lifeEvents.hasLifeEventSlug).toHaveBeenCalledWith('a-slug');
  });

  it('無い識別子と、書き換える前の識別子は 404 の画面へ rewrite する（FR-034・SC-007）', async () => {
    lifeEvents.hasLifeEventSlug.mockResolvedValue(false);
    expect(await rewrittenPath('/life-events/no-such')).toBe('/life-events/no-such/missing');
  });

  it('オーナーを確かめずに通す。訪問者のページなので', async () => {
    author.getAuthorFromHeaders.mockResolvedValue(null);
    expect(await rewrittenPath('/life-events/a-slug')).toBeNull();
  });
});

describe('/dash/life-events/{uid}', () => {
  it.each([`/dash/life-events/${UID}`, `/dash/life-events/${UID}/delete`])(
    '無い uid の %s は 404 の画面へ rewrite する',
    async (path) => {
      lifeEvents.hasLifeEventUid.mockResolvedValue(false);
      expect(await rewrittenPath(path)).toBe(`/dash/life-events/${UID}/missing`);
    },
  );

  it.each(['/dash/life-events', '/dash/life-events/new'])('%s は行の有無を見ない', async (path) => {
    expect(await rewrittenPath(path)).toBeNull();
    expect(lifeEvents.hasLifeEventUid).not.toHaveBeenCalled();
  });
});

describe('/dash/activities/{uid}（specs/004-external-activity/contracts/dash.md）', () => {
  it.each([`/dash/activities/${UID}`, `/dash/activities/${UID}/delete`])(
    '無い uid の %s は 404 の画面へ rewrite する',
    async (path) => {
      lifeEvents.hasExternalActivityUid.mockResolvedValue(false);
      expect(await rewrittenPath(path)).toBe(`/dash/activities/${UID}/missing`);
    },
  );

  it.each(['/dash/activities', '/dash/activities/new'])('%s は行の有無を見ない', async (path) => {
    expect(await rewrittenPath(path)).toBeNull();
    expect(lifeEvents.hasExternalActivityUid).not.toHaveBeenCalled();
  });
});

/** note のページ（specs/003-note/contracts/visitor-note.md、research.md の R9） */
describe('/notes/{slug}', () => {
  it('訪問者に見せる note がある識別子は rewrite しない', async () => {
    expect(await rewrittenPath('/notes/a-slug')).toBeNull();
    expect(notes.hasNoteSlug).toHaveBeenCalledWith('a-slug');
  });

  it('無い・下書き・削除した note の識別子は 404 の画面へ rewrite する', async () => {
    notes.hasNoteSlug.mockResolvedValue(false);
    expect(await rewrittenPath('/notes/no-such')).toBe('/notes/no-such/missing');
  });

  it('オーナーかを確かめず、no-store を付けない', async () => {
    const response = await proxy(request('/notes/a-slug'));
    expect(author.getAuthorFromHeaders).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('書き込みの要求は判定しない', async () => {
    notes.hasNoteSlug.mockResolvedValue(false);
    expect(await rewrittenPath('/notes/a-slug', 'POST')).toBeNull();
    expect(notes.hasNoteSlug).not.toHaveBeenCalled();
  });

  it('D1 から読み出せなければ、判定せずにページへ通す', async () => {
    notes.hasNoteSlug.mockRejectedValue(new Error('D1_ERROR'));
    expect(await rewrittenPath('/notes/a-slug')).toBeNull();
  });
});

/** note の過去の版の画面（specs/003-note/contracts/dash.md、research.md の R9） */
describe('/dash/notes/{uid}/revisions/{revisionUid}', () => {
  it('ある版は rewrite しない', async () => {
    expect(await rewrittenPath(`/dash/notes/${UID}/revisions/${ROW_UID}`)).toBeNull();
    expect(notes.findMissingNoteRevision).toHaveBeenCalledWith(UID, ROW_UID);
  });

  it('その note に無い版は、版の 404 の画面へ rewrite する', async () => {
    notes.findMissingNoteRevision.mockResolvedValue('revision');
    expect(await rewrittenPath(`/dash/notes/${UID}/revisions/${ROW_UID}`)).toBe(
      `/dash/notes/${UID}/revisions/${ROW_UID}/missing`,
    );
  });

  it('無い note は、note の 404 の画面へ rewrite する', async () => {
    notes.findMissingNoteRevision.mockResolvedValue('note');
    expect(await rewrittenPath(`/dash/notes/${UID}/revisions/${ROW_UID}`)).toBe(
      `/dash/notes/${UID}/missing`,
    );
  });

  it('note の有無を、版の有無と別に問い合わせない', async () => {
    await rewrittenPath(`/dash/notes/${UID}/revisions/${ROW_UID}`);
    expect(notes.hasNoteUid).not.toHaveBeenCalled();
  });

  it.each([`/dash/notes/${UID}/revisions`, `/dash/notes/${UID}/revisions/${ROW_UID}/missing`])(
    '%s は版の有無を見ない',
    async (path) => {
      notes.findMissingNoteRevision.mockResolvedValue('revision');
      expect(await rewrittenPath(path)).toBeNull();
      expect(notes.findMissingNoteRevision).not.toHaveBeenCalled();
    },
  );
});

/** 実績の画像の経路（specs/001-career-and-project/spec.md の FR-030） */
describe('/projects/{slug}/media/{key}', () => {
  const PATH = '/projects/a-slug/media/11111111-1111-4111-8111-111111111111';

  it('proxy の対象にし、D1 を読まずに通す', async () => {
    expect(unstable_doesMiddlewareMatch({ config, url: PATH })).toBe(true);
    projects.hasProjectSlug.mockResolvedValue(false);
    expect(await rewrittenPath(PATH)).toBeNull();
    expect(projects.hasProjectSlug).not.toHaveBeenCalled();
  });
});

/** note の画像の経路（specs/003-note/research.md の R9） */
describe('/notes/{slug}/media/{key}', () => {
  const PATH = '/notes/a-slug/media/11111111-1111-4111-8111-111111111111';

  it('proxy の対象にし、D1 を読まずに通す', async () => {
    expect(unstable_doesMiddlewareMatch({ config, url: PATH })).toBe(true);
    notes.hasNoteSlug.mockResolvedValue(false);
    expect(await rewrittenPath(PATH)).toBeNull();
    expect(notes.hasNoteSlug).not.toHaveBeenCalled();
  });
});
