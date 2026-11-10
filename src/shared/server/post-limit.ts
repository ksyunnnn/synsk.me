import { routes } from '@/shared/routes';
/**
 * `/dash` の外への POST の本文の上限。Worker の入口（worker/index.ts）が、vinext に渡す前に拒む。
 *
 * Server Action の本文の上限（next.config.js の `experimental.serverActions.bodySizeLimit`、
 * 10.5 MB）は経路で分けられず、Server Action はどの経路へ送っても動く。画像を上げるのは `/dash` の
 * 中だけなので、`/dash` の外では vinext の既定の 1 MB で止める（docs/SOFTWARE_DESIGN.md の
 * 原則 1・2）。`src/proxy.ts` では拒まない。matcher をすべての経路に広げると、vinext が
 * どの経路もキャッシュの判定で dynamic にし、`/` のエッジのキャッシュが崩れる（ADR-0040）
 */

/** `/dash` の外への POST の本文の上限。vinext の Server Action の既定と同じ 1 MB */
export const PUBLIC_POST_MAX_BYTES = 1024 * 1024;

const isDashPath = (pathname: string) =>
  pathname === routes.dash.index || pathname.startsWith(`${routes.dash.index}/`);

/**
 * 入口で拒むなら、その応答。通すなら null。
 * - `Content-Length` が無い POST は 411。長さが分からないまま読み始めると、上限を超えるかを読む前に
 *   決められない（原則 2）。ブラウザのフォームの送信と Server Action の呼び出しは
 *   `Content-Length` を付ける（tests/e2e/post-limit.spec.ts）
 * - 上限を超える POST と、長さが読めない POST は 413
 */
export const rejectLargePublicPost = (request: Request): Response | null => {
  if (request.method !== 'POST' || isDashPath(new URL(request.url).pathname)) return null;
  const header = request.headers.get('content-length');
  if (header === null) return new Response('Length Required', { status: 411 });
  const length = /^\d+$/.test(header.trim()) ? Number(header.trim()) : Number.NaN;
  if (!Number.isSafeInteger(length) || length > PUBLIC_POST_MAX_BYTES)
    return new Response('Payload Too Large', { status: 413 });
  return null;
};
