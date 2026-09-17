/**
 * `scripts/verify-deploy.mjs` が使う純関数。
 *
 * 検査の本体はネットワークに触れるため単体テストの対象にできない。判定の材料を
 * 作る部分だけをここに置き、`tests/unit/verify-deploy.test.ts` が検査する。
 */

/** PNG の先頭 8 バイト。 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * HTML が参照するクライアント JS の絶対パスを、重複を除いて返す。
 *
 * `src` と `href` の両方を拾う。vinext は `modulepreload` の `link` と
 * `script` の両方で同じチャンクを指すため、重複を除かないと同じ取得を繰り返す。
 *
 * @param {string} html
 * @returns {string[]}
 */
export function extractChunkPaths(html) {
  const matches = html.matchAll(/["'](\/_next\/static\/[^"']+\.js)["']/g);
  return [...new Set(Array.from(matches, (match) => match[1]))].sort();
}

/**
 * 先頭バイトが PNG かを返す。ステータスが 200 でも中身が空という出方をするため、
 * `ImageResponse` の検査はここまで見る。
 *
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function isPng(bytes) {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

/**
 * エッジのキャッシュを迂回する URL を作る。
 *
 * 昇格の直後、キャッシュには新しい版の HTML があり、Worker はまだ古い版で
 * 応答することがある。キャッシュ済みの HTML から抽出したチャンクを古い版に
 * 求めると 404 になる（#71）。クエリを一意にすると vinext の cacheability
 * manifest が許可する識別子から外れ、配信中の版そのものが応答する。
 *
 * @param {string} base
 * @param {string} path
 * @param {string} nonce
 * @returns {string}
 */
export function bypassCacheUrl(base, path, nonce) {
  const url = new URL(path, base);
  url.searchParams.set('__verify', nonce);
  return url.toString();
}

/** 本番のホスト名。これ以外はプレビュー配信とみなす。 */
const PRODUCTION_HOSTNAME = 'synsk.me';

/**
 * 検査の対象が本番かを返す。
 *
 * @param {string} base
 * @returns {boolean}
 */
export function isProductionBase(base) {
  return new URL(base).hostname === PRODUCTION_HOSTNAME;
}

/** Access の service token を置く環境変数。wrangler が同じ名前で読む。 */
const ACCESS_CLIENT_ID_ENV = 'CLOUDFLARE_ACCESS_CLIENT_ID';
const ACCESS_CLIENT_SECRET_ENV = 'CLOUDFLARE_ACCESS_CLIENT_SECRET';

/**
 * 検査の要求に付ける、Access を通るためのヘッダを返す。
 *
 * 本番の Access は `/dash` だけを守るため、何も付けない。プレビュー配信は全体が
 * Access の後ろにあるため、service token を `CF-Access-Client-Id` と
 * `CF-Access-Client-Secret` に付ける。欠けていれば、欠けた環境変数の名前を返す。
 *
 * @param {string} base
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true, headers: Record<string, string> } | { ok: false, missing: string[] }}
 */
export function accessHeadersFor(base, env) {
  if (isProductionBase(base)) return { ok: true, headers: {} };
  const clientId = env[ACCESS_CLIENT_ID_ENV];
  const clientSecret = env[ACCESS_CLIENT_SECRET_ENV];
  const missing = [];
  if (!clientId) missing.push(ACCESS_CLIENT_ID_ENV);
  if (!clientSecret) missing.push(ACCESS_CLIENT_SECRET_ENV);
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    headers: { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret },
  };
}

/** Access の team domain は `<team-name>.cloudflareaccess.com` の形をとる。 */
const ACCESS_TEAM_DOMAIN_SUFFIX = '.cloudflareaccess.com';

/**
 * 応答が Access のログインへの移動かを返す。
 *
 * ホスト名の末尾で見る。`cloudflareaccess.com` を含むだけの別のホストを通さない。
 *
 * @param {number} status
 * @param {string | null} location
 * @param {string} base 相対の `Location` を解決する基準
 * @returns {boolean}
 */
export function isAccessLoginRedirect(status, location, base) {
  if (status < 300 || status >= 400 || !location) return false;
  try {
    return new URL(location, base).hostname.endsWith(ACCESS_TEAM_DOMAIN_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * 存在しない note の経路を作る。
 *
 * slug は、作り手が作りうる形（英小文字・数字・ハイフン）にそろえる。nonce を
 * 含めるのは、同じ slug の note を作り手が作っていても当たらないようにするため。
 *
 * @param {string} nonce
 * @returns {string}
 */
export function absentNotePath(nonce) {
  return `/notes/verify-deploy-absent-${nonce.replace(/[^a-z0-9-]/g, '')}`;
}
