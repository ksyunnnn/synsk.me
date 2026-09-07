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
