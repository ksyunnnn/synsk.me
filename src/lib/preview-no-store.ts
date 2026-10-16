/**
 * プレビュー配信の応答を、どのキャッシュにも残さない（docs/REQUIREMENTS.md の NFR-09）。
 *
 * プレビュー配信は全体が Access の後ろにあり、どの応答も認証を要する。本番は
 * `synsk.me` だけを入口にし（`wrangler.jsonc` の `workers_dev: false`）、プレビューは
 * `*.workers.dev` の URL で配信される。手元のテストは `127.0.0.1` で動く。
 */

const PREVIEW_HOST_SUFFIX = '.workers.dev';

const NO_STORE = 'no-store, must-revalidate';

/**
 * Cloudflare は `CDN-Cache-Control` と `Cloudflare-CDN-Cache-Control` を
 * `Cache-Control` より優先する。vinext はキャッシュしてよい応答に前者を付ける
 * （`@vinext/cloudflare/dist/cache/cdn-adapter.runtime.js`）
 */
const EDGE_CACHE_HEADERS = ['CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control'];

export const isPreviewRequest = (url: string) =>
  new URL(url).hostname.endsWith(PREVIEW_HOST_SUFFIX);

/** 応答のヘッダを、どのキャッシュにも残さない形に書き換える。本文と状態コードは変えない */
export const withNoStore = (response: Response) => {
  const copied = new Response(response.body, response);
  copied.headers.set('Cache-Control', NO_STORE);
  for (const name of EDGE_CACHE_HEADERS) copied.headers.delete(name);
  return copied;
};
