/**
 * 関連 URL として通す URL か。画面でリンクにするため、http か https の URL だけを通す。
 * 使い手は project と career の入力
 */
export const isWebUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * 同じ項目かを URL で判定するために、URL を揃える。http か https の URL でなければ null。
 * 使い手は 004 の取り込み（specs/004-external-activity/spec.md の FR-005・FR-008）と、003 の
 * 転載先（ADR-0006、specs/003-note/spec.md の FR-032）。保存する値と比べる値の両方をこれで揃える。
 *
 * 揃えるのは、どのサーバでも同じ資源を指すと RFC 3986 の 6.2.2・6.2.3 が定める違いと、
 * フラグメントだけ（URL の構文は WHATWG URL Standard の `URL` が読む）。
 * - スキームとホスト名を小文字にする。国際化ドメイン名は Punycode にする
 * - 既定のポート（http の 80、https の 443）を消す。空のパスは `/` にする
 * - パスの `.` と `..` を解く。パーセントエンコードの 16 進を大文字にする
 * - フラグメント（`#` から後）を消す。フラグメントはサーバに送られず、同じ文書の中の位置を指す
 *
 * 揃えないもの: パスとクエリの大文字と小文字、末尾のスラッシュ、クエリの順と追跡用の値、
 * `www.` の有無、http と https。どれもサーバによって別の資源を指しうる。揃えすぎると、別の項目を
 * 同じ項目とみなし、一覧から消してしまう。揃え足りないと、同じ項目が 2 件並ぶだけで、見て直せる
 */
export const normalizeWebUrl = (value: string): string | null => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  const upperHex = (text: string) => text.replace(/%[0-9a-f]{2}/gi, (code) => code.toUpperCase());
  // 変わるときだけ入れ直す。空のクエリ（末尾の `?`）を入れ直すと `?` が消える
  if (upperHex(url.pathname) !== url.pathname) url.pathname = upperHex(url.pathname);
  if (upperHex(url.search) !== url.search) url.search = upperHex(url.search);
  return url.href;
};
