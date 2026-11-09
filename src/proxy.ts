import { NextResponse, type NextRequest } from 'next/server';
import { hasCareerUid } from '@/features/career/server/queries';
import { hasEducationUid } from '@/features/education/server/queries';
import { hasNoteSlug, hasNoteUid } from '@/features/note/server/queries';
import { hasOrganizationUid } from '@/features/organization/server/queries';
import { hasProjectSlug, hasProjectUid } from '@/features/project/server/queries';
import {
  findMissingResumeRow,
  hasResumeUid,
  hasVisitorResume,
} from '@/features/resume/server/queries';
import { hasSkillUid } from '@/features/skill/server/queries';
import { getAuthorFromHeaders } from '@/shared/server/author';

/**
 * データを読んでから決まる 404 と 403 を、描画の前に決める。
 *
 * Cache Components では、ストリーミングを始めた後の `notFound()` と `forbidden()` は
 * 状態コードを 200 のままにする（https://nextjs.org/docs/app/guides/streaming の
 * 「The HTTP contract」）。公式は、描画の前に proxy で確かめる形を示す
 * （https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes）。
 *
 * ページと Server Action のオーナーの確認は残す。公式は、オーナーの確認を proxy だけに
 * 頼らないよう求める（https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 * の「Always verify authentication and authorization inside each Server Function」）。
 *
 * D1 や設定値を読み出せないときは判定せずにページへ通す。ページがオーナーを確かめる。
 */

export const config = {
  matcher: ['/projects/:slug', '/resume/:path*', '/notes/:slug', '/dash', '/dash/:path*'],
};

/** 404 と 403 の画面。`notFound()` か `forbidden()` を呼ぶだけのページ */
const projectPageMissing = (slug: string) => `/projects/${slug}/missing`;
const resumePageMissing = (slug: string) => `/resume/${slug}/missing`;
const notePageMissing = (slug: string) => `/notes/${slug}/missing`;
const DASH_FORBIDDEN = '/dash/forbidden';

/**
 * 管理画面のうち、uid で開く行の画面。uid の行が無ければ `/dash/<コレクション>/{uid}/missing`
 * へ rewrite する（specs/001-career-and-project/contracts/dash.md の共通）。主キーは URL に
 * 出さない（ADR-0048）
 */
const DASH_ROW_EXISTS: Record<string, (uid: string) => Promise<boolean>> = {
  projects: hasProjectUid,
  organizations: hasOrganizationUid,
  skills: hasSkillUid,
  careers: hasCareerUid,
  educations: hasEducationUid,
  resumes: hasResumeUid,
  notes: hasNoteUid,
};

/**
 * 職務経歴書に属する写した行の画面（`/dash/resumes/{uid}/<種類>/{rowUid}`）。行が無いか、その
 * 職務経歴書に属さなければ `/dash/resumes/{uid}/<種類>/{rowUid}/missing` へ rewrite する
 * （specs/002-resume/contracts/dash.md の共通）。`/dash/resumes/{uid}/<種類>/new` は足す画面で、
 * 行の有無を見ない
 */
const RESUME_ROW_KINDS = new Set(['careers', 'projects', 'educations']);

/**
 * 職務経歴書の経路（`/resume/{slug}` と、その下の `/resume/{slug}/missing`）か。限定公開用か
 * 公開用かは D1 を読むまで分からないため、識別子を含む経路のすべてに限定公開用のヘッダを付ける
 * （specs/002-resume/research.md の R7）。公開用は tasks.md の Phase 7（US5）で足す
 */
const isResumeSlugPath = (segments: string[]) => segments[0] === 'resume' && segments.length >= 2;

const decide = async (request: NextRequest): Promise<string | null> => {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  // 書き込みの操作は、Server Action がオーナーと行を確かめて結果を返す
  const isRead = request.method === 'GET' || request.method === 'HEAD';

  if (segments[0] === 'projects') {
    const slug = segments[1];
    if (!isRead || !slug) return null;
    return (await hasProjectSlug(slug)) ? null : projectPageMissing(slug);
  }

  if (segments[0] === 'resume') {
    // 公開用は tasks.md の Phase 7（US5）で足すまで中身を返さず、404 になる
    const [, slug] = segments;
    if (!isRead || segments.length !== 2) return null;
    return (await hasVisitorResume(slug)) ? null : resumePageMissing(slug);
  }

  if (segments[0] === 'notes') {
    // 下書き・下書きに戻した・削除した note は、無い識別子と同じ 404（specs/003-note/plan.md の U10）
    const slug = segments[1];
    if (!isRead || !slug) return null;
    return (await hasNoteSlug(slug)) ? null : notePageMissing(slug);
  }

  if (!(await getAuthorFromHeaders(request.headers))) return DASH_FORBIDDEN;

  const [, collection, uid, action, rowUid, rowAction] = segments;
  const exists = collection === undefined ? undefined : DASH_ROW_EXISTS[collection];
  if (!isRead || !exists || !uid || uid === 'new' || action === 'missing') return null;
  if (
    collection === 'resumes' &&
    RESUME_ROW_KINDS.has(action) &&
    rowUid &&
    rowUid !== 'new' &&
    rowAction !== 'missing'
  ) {
    // 職務経歴書と行の有無を 1 回で確かめる。職務経歴書の id を D1 から 2 回引かない
    const missing = await findMissingResumeRow(uid, action, rowUid);
    if (missing === 'resume') return `/dash/resumes/${uid}/missing`;
    return missing === 'row' ? `/dash/resumes/${uid}/${action}/${rowUid}/missing` : null;
  }
  return (await exists(uid)) ? null : `/dash/${collection}/${uid}/missing`;
};

/**
 * オーナーの経路の応答を、どのキャッシュにも残さない（docs/REQUIREMENTS.md の NFR-09）。
 * 画面は vinext が `no-store` を付けるが、JavaScript なしの操作の結果の 303 には何も
 * 付けない。vinext は proxy の応答ヘッダを 303 に写す
 * （`vinext/dist/server/app-server-action-execution.js` の `mergeMiddlewareResponseHeaders`）
 */
const NO_STORE = 'no-store, must-revalidate';

const respond = async (request: NextRequest) => {
  let path: string | null;
  try {
    path = await decide(request);
  } catch {
    return NextResponse.next();
  }
  return path ? NextResponse.rewrite(new URL(path, request.url)) : NextResponse.next();
};

/**
 * 限定公開用の職務経歴書の応答のヘッダ（specs/002-resume/research.md の R7）。中身を返すか
 * どうかに関わらず、D1 を読む前に決め、200・404・判定できないときのすべてに付ける
 */
const LIMITED_RESUME_HEADERS = {
  'Cache-Control': NO_STORE,
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
} as const;

export const proxy = async (request: NextRequest) => {
  const response = await respond(request);
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  if (segments[0] === 'dash') {
    response.headers.set('Cache-Control', NO_STORE);
  }
  if (isResumeSlugPath(segments)) {
    for (const [name, value] of Object.entries(LIMITED_RESUME_HEADERS)) {
      response.headers.set(name, value);
    }
  }
  return response;
};
