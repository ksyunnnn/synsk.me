import { NextResponse, type NextRequest } from 'next/server';
import { hasCareerId } from '@/features/career/server/queries';
import { hasEducationId } from '@/features/education/server/queries';
import { hasOrganizationId } from '@/features/organization/server/queries';
import { hasProjectId, hasProjectSlug } from '@/features/project/server/queries';
import { hasResumeId, hasResumeRow, hasVisitorResume } from '@/features/resume/server/queries';
import { hasSkillId } from '@/features/skill/server/queries';
import { getAuthorFromHeaders } from '@/shared/server/author';

/**
 * データを読んでから決まる 404 と 403 を、描画の前に決める。
 *
 * Cache Components では、ストリーミングを始めた後の `notFound()` と `forbidden()` は
 * 状態コードを 200 のままにする（https://nextjs.org/docs/app/guides/streaming の
 * 「The HTTP contract」）。公式は、描画の前に proxy で確かめる形を示す
 * （https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes）。
 *
 * ページと Server Action の作り手の確認は残す。公式は、作り手の確認を proxy だけに
 * 頼らないよう求める（https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 * の「Always verify authentication and authorization inside each Server Function」）。
 *
 * D1 や設定値を読み出せないときは判定せずにページへ通す。ページが作り手を確かめる。
 */

export const config = {
  matcher: ['/projects/:slug', '/resume/:path*', '/dash', '/dash/:path*'],
};

/** 404 と 403 の画面。`notFound()` か `forbidden()` を呼ぶだけのページ */
const projectPageMissing = (slug: string) => `/projects/${slug}/missing`;
const resumePageMissing = (slug: string) => `/resume/${slug}/missing`;
const DASH_FORBIDDEN = '/dash/forbidden';

/**
 * 管理画面のうち、id で開く行の画面。id の行が無ければ `/dash/<コレクション>/{id}/missing`
 * へ rewrite する（specs/001-career-and-project/contracts/dash.md の共通）
 */
const DASH_ROW_EXISTS: Record<string, (id: string) => Promise<boolean>> = {
  projects: hasProjectId,
  organizations: hasOrganizationId,
  skills: hasSkillId,
  careers: hasCareerId,
  educations: hasEducationId,
  resumes: hasResumeId,
};

/**
 * 職務経歴書に属する写した行の画面（`/dash/resumes/{id}/<種類>/{rowId}`）。行が無いか、その
 * 職務経歴書に属さなければ `/dash/resumes/{id}/<種類>/{rowId}/missing` へ rewrite する
 * （specs/002-resume/contracts/dash.md の共通）
 */
const RESUME_ROW_KINDS = new Set(['careers', 'projects', 'educations']);

/**
 * 限定公開用の職務経歴書の経路（`/resume/{slug}/{key}`）か。`/resume/{slug}/missing` も同じ深さに
 * あり、同じヘッダを付ける（specs/002-resume/research.md の R7）
 */
const isLimitedResumePath = (segments: string[]) =>
  segments[0] === 'resume' && segments.length === 3;

const decide = async (request: NextRequest): Promise<string | null> => {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  // 書き込みの操作は、Server Action が作り手と行を確かめて結果を返す
  const isRead = request.method === 'GET' || request.method === 'HEAD';

  if (segments[0] === 'projects') {
    const slug = segments[1];
    if (!isRead || !slug) return null;
    return (await hasProjectSlug(slug)) ? null : projectPageMissing(slug);
  }

  if (segments[0] === 'resume') {
    // 公開用の `/resume/{slug}` は tasks.md の Phase 7（US5）で足す。いまは経路が無く 404
    const [, slug, key] = segments;
    if (!isRead || !isLimitedResumePath(segments) || key === 'missing') return null;
    return (await hasVisitorResume(slug, key)) ? null : resumePageMissing(slug);
  }

  if (!(await getAuthorFromHeaders(request.headers))) return DASH_FORBIDDEN;

  const [, collection, id, action, rowId, rowAction] = segments;
  const exists = collection === undefined ? undefined : DASH_ROW_EXISTS[collection];
  if (!isRead || !exists || !id || id === 'new' || action === 'missing') return null;
  if (!(await exists(id))) return `/dash/${collection}/${id}/missing`;
  if (
    collection === 'resumes' &&
    RESUME_ROW_KINDS.has(action) &&
    rowId &&
    rowAction !== 'missing'
  ) {
    return (await hasResumeRow(id, action, rowId))
      ? null
      : `/dash/resumes/${id}/${action}/${rowId}/missing`;
  }
  return null;
};

/**
 * 作り手の経路の応答を、どのキャッシュにも残さない（docs/REQUIREMENTS.md の NFR-09）。
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
 * 限定公開用の職務経歴書の応答のヘッダ（specs/002-resume/research.md の R5・R7）。中身を返すか
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
  if (isLimitedResumePath(segments)) {
    for (const [name, value] of Object.entries(LIMITED_RESUME_HEADERS)) {
      response.headers.set(name, value);
    }
  }
  return response;
};
