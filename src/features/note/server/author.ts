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

/**
 * 公開鍵の取得先ごとの鍵の集まり。要求をまたいで使い回す。要求ごとに作ると、`jose` が
 * 持つ鍵のキャッシュが効かず、毎回 Access へ取りに行き、一度の失敗で作り手を拒む
 */
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const keySetFor = (certsUrl: string) => {
  let keys = keySets.get(certsUrl);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(certsUrl));
    keySets.set(certsUrl, keys);
  }
  return keys;
};

/**
 * 2つのメールアドレスが同じ宛先かを比べる。`@` より前（ローカル部）は大文字と小文字を
 * 区別し、`@` より後（ドメイン）は区別しない。RFC 5321 の 2.4 節が「The local-part of a
 * mailbox MUST BE treated as case sensitive.」「Mailbox domains follow normal DNS rules and
 * are hence not case sensitive.」と定めるため。
 *
 * DNS が大文字と小文字を区別しないのは ASCII の英字だけである（RFC 4343）。`toLowerCase()`
 * は ASCII 以外も畳み、ケルビン記号（U+212A）を `k` にするなど、別のドメインを同じと
 * みなしうる。そのため ASCII の英字だけを畳み、ASCII 以外を含むドメインは一致させない
 */
export const isSameMailbox = (a: string, b: string): boolean => {
  const at = (address: string) => address.lastIndexOf('@');
  const [ia, ib] = [at(a), at(b)];
  if (ia <= 0 || ib <= 0) return false;
  const [domainA, domainB] = [a.slice(ia + 1), b.slice(ib + 1)];
  const isAsciiDomain = (domain: string) => /^[\x21-\x7e]+$/.test(domain);
  if (!isAsciiDomain(domainA) || !isAsciiDomain(domainB)) return false;
  const foldAscii = (domain: string) => domain.replace(/[A-Z]/g, (c) => c.toLowerCase());
  return a.slice(0, ia) === b.slice(0, ib) && foldAscii(domainA) === foldAscii(domainB);
};

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
 * Worker の secret から検証の設定値を作る。JWT の `iss` は末尾に `/` を持たないため、
 * secret に `/` が付いていても落としてから使う
 */
export const toAccessSettings = (env: {
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
  ACCESS_OWNER_EMAIL?: string;
}): AccessSettings => {
  const issuer = env.ACCESS_ISSUER?.replace(/\/+$/, '') || undefined;
  return {
    certsUrl: issuer ? `${issuer}/cdn-cgi/access/certs` : undefined,
    issuer,
    audience: env.ACCESS_AUD,
    ownerEmail: env.ACCESS_OWNER_EMAIL,
  };
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
    const { payload } = await jwtVerify(token, keySetFor(certsUrl), {
      issuer,
      audience: audiences,
      algorithms: ['RS256'],
    });
    return typeof payload.email === 'string' && isSameMailbox(payload.email, ownerEmail)
      ? { email: ownerEmail }
      : null;
  } catch {
    return null;
  }
};
