/**
 * 限定公開用の鍵（specs/002-resume/spec.md の FR-011・FR-012、research.md の R5）。
 * 鍵は 32 バイト（256 ビット）の乱数を base64url にした 43 文字。D1 には鍵の SHA-256 の 16 進だけを
 * 持ち、平文を書かない。Web Crypto だけを使い、Workers と Node の両方で動く
 */

/** 鍵の長さ。32 バイトの base64url（パディングなし） */
export const LIMITED_KEY_LENGTH = 43;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/** 新しい鍵の平文 */
export const generateLimitedKey = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

/** URL に置かれた値が鍵の形か。形が違えばハッシュを求めずに拒む */
export const isLimitedKeyShape = (value: string): boolean =>
  value.length === LIMITED_KEY_LENGTH && /^[A-Za-z0-9_-]+$/.test(value);

/** 鍵の SHA-256 の 16 進（`resume.limited_token_hash` に入れる値） */
export const hashLimitedKey = async (key: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * 2 つの同じ長さのバイト列を、一致する位置に関わらず同じ手間で比べる。Workers は
 * `crypto.subtle.timingSafeEqual` を持つ（https://developers.cloudflare.com/workers/runtime-apis/web-crypto/）。
 * 持たない環境（Node の単体の検査）では、すべてのバイトを比べ終えてから結果を返す
 */
const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
  };
  if (typeof subtle.timingSafeEqual === 'function') return subtle.timingSafeEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

/**
 * 送られた鍵が、保存したハッシュと一致するか。ハッシュの長さは一定のため、`timingSafeEqual` が
 * 長さの違いで例外を投げることは無い。保存したハッシュの形が違えば一致しない
 */
export const matchesLimitedKey = async (key: string, storedHash: string): Promise<boolean> => {
  if (!isLimitedKeyShape(key) || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(await hashLimitedKey(key)), encoder.encode(storedHash));
};
