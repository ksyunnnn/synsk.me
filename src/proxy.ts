import { NextResponse, type NextRequest } from 'next/server';
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

export const config = { matcher: ['/dash', '/dash/:path*'] };

/** 403 の画面。`forbidden()` を呼ぶだけのページ */
const DASH_FORBIDDEN = '/dash/forbidden';

const decide = async (request: NextRequest): Promise<string | null> =>
  (await getAuthorFromHeaders(request.headers)) ? null : DASH_FORBIDDEN;

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
