import { NextResponse, type NextRequest } from 'next/server';
import { hasProjectId, hasProjectSlug } from '@/features/project/server/queries';
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

export const config = { matcher: ['/projects/:slug', '/dash', '/dash/:path*'] };

/** 404 と 403 の画面。`notFound()` か `forbidden()` を呼ぶだけのページ */
const projectPageMissing = (slug: string) => `/projects/${slug}/missing`;
const DASH_FORBIDDEN = '/dash/forbidden';

/**
 * 管理画面のうち、id で開く行の画面。id の行が無ければ `/dash/<コレクション>/{id}/missing`
 * へ rewrite する（specs/001-career-and-project/contracts/dash.md の共通）
 */
const DASH_ROW_EXISTS: Record<string, (id: string) => Promise<boolean>> = {
  projects: hasProjectId,
};

const decide = async (request: NextRequest): Promise<string | null> => {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  // 書き込みの操作は、Server Action が作り手と行を確かめて結果を返す
  const isRead = request.method === 'GET' || request.method === 'HEAD';

  if (segments[0] === 'projects') {
    const slug = segments[1];
    if (!isRead || !slug) return null;
    return (await hasProjectSlug(slug)) ? null : projectPageMissing(slug);
  }

  if (!(await getAuthorFromHeaders(request.headers))) return DASH_FORBIDDEN;

  const [, collection, id, action] = segments;
  const exists = collection === undefined ? undefined : DASH_ROW_EXISTS[collection];
  if (!isRead || !exists || !id || id === 'new' || action === 'missing') return null;
  return (await exists(id)) ? null : `/dash/${collection}/${id}/missing`;
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

export const proxy = async (request: NextRequest) => {
  const response = await respond(request);
  if (request.nextUrl.pathname.split('/')[1] === 'dash') {
    response.headers.set('Cache-Control', NO_STORE);
  }
  return response;
};
