import 'server-only';

import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Cloudflare Access が `Cf-Access-Jwt-Assertion` に付ける JWT を検証し、作り手で
 * あることを確かめる（docs/decisions/0036-verify-access-jwt-in-app.md）。
 *
 * `/dash` 配下の画面と書き込みの操作は、Access の後ろにあっても、これを先に呼ぶ。
 * vinext の Server Action は経路に縛られず、`/dash` の外への POST からも呼べるため。
 *
 * JWT とその中身の型はこのファイルの外に出さず、`Author` に詰め替える
 * （constitution の VII. Boundary Translation）。
 */

/** 作り手 */
export type Author = { email: string };

/** 検証に使う設定値。どれかが欠けていれば、作り手であることを確かめられない */
export type AccessSettings = {
  /** 公開鍵の取得先。`<issuer>/cdn-cgi/access/certs` */
  certsUrl: string | undefined;
  /** JWT の `iss`。Access の team domain */
  issuer: string | undefined;
  /**
   * JWT の `aud`。Access のアプリケーションの AUD タグ。本番の `/dash` とプレビュー全体の
   * アプリケーションは別の AUD タグを持つため、カンマで区切って複数を持てる。どれかに
   * 一致すれば通す
   */
  audience: string | undefined;
  /** 作り手として認めるメールアドレス */
  ownerEmail: string | undefined;
};

/**
 * 作り手であることを確かめられれば `Author` を、確かめられなければ null を返す。
 * 設定値が欠けている、JWT がない、署名・`iss`・`aud`・期限のどれかが合わない、
 * メールアドレスがオーナーのものでない、公開鍵が取れない、のどれでも null
 */
export const verifyAuthor = async (
  token: string | null | undefined,
  { certsUrl, issuer, audience, ownerEmail }: AccessSettings,
): Promise<Author | null> => {
  const audiences = (audience ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  if (!token || !certsUrl || !issuer || audiences.length === 0 || !ownerEmail) return null;

  try {
    // 公開鍵は Access が入れ替えるため、埋め込まずに取りに行く
    const keys = createRemoteJWKSet(new URL(certsUrl));
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: audiences,
      algorithms: ['RS256'],
    });
    // 大文字と小文字を区別して比べる。緩めると、オーナーでない人を通しうる
    return payload.email === ownerEmail ? { email: ownerEmail } : null;
  } catch {
    return null;
  }
};
