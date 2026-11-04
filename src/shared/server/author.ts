/// <reference types="vite/client" />
import 'server-only';

import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Author } from '@/shared/domain/author';
import { readEnv, type AccessEnv } from '@/shared/server/env';

/**
 * Cloudflare Access が `Cf-Access-Jwt-Assertion` に付ける JWT を検証し、作り手で
 * あることを確かめる（ADR-0013・ADR-0036）。
 *
 * `/dash` 配下の画面は描画の前に、書き込みの Server Action は書き込みの前に、これを呼ぶ。
 * Server Action は経路に縛られず、`/dash` の外への POST からも呼べるため。
 *
 * JWT とその中身の型はこのファイルの外に出さず、`Author` に詰め替える
 * （constitution の VII. Boundary Translation）。
 */

export type { Author };

/** Cloudflare Access が JWT を入れるヘッダ */
const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

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
export const toAccessSettings = (env: AccessEnv): AccessSettings => {
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

/**
 * 要求のヘッダから、作り手なら `Author` を、確かめられなければ null を返す。`src/proxy.ts`
 * は描画の前に動き、`headers()` を使えないため、要求のヘッダを直接渡す
 */
export const getAuthorFromHeaders = async (requestHeaders: Headers): Promise<Author | null> => {
  // `npm run dev`（vinext dev）でだけ、JWT を確かめずに作り手として扱う。手元には JWT を
  // 付ける Cloudflare Access がいないため。`import.meta.env.DEV` と `import.meta.env.MODE` は
  // Vite が build のときに定数（false と 'production'）へ置き換え、この分岐は dist/ に残らない
  // （https://vite.dev/guide/env-and-mode）。実行時の環境変数では切り替えない。
  // dist/ に残っていないことは tests/integration/dev-author.test.ts が確かめる
  if (import.meta.env.DEV && import.meta.env.MODE === 'development') {
    // 固定の値は、`ACCESS_OWNER_EMAIL` が無いときに使う。この値が dist/ に無いことを、分岐が
    // 消えた印として tests/integration/dev-author.test.ts が見る
    return { email: (await readEnv()).ACCESS_OWNER_EMAIL || 'dev-author@localhost.invalid' };
  }
  return verifyAuthor(requestHeaders.get(ACCESS_JWT_HEADER), toAccessSettings(await readEnv()));
};

/** この要求を送ったのが作り手なら `Author` を、確かめられなければ null を返す */
export const getCurrentAuthor = async (): Promise<Author | null> =>
  getAuthorFromHeaders(await headers());

/**
 * 作り手であることを確かめる。確かめられなければ `forbidden()` で、画面の中身を返さずに
 * 403 にする。`/dash` 配下の画面は、何かを読む前にこれを通す（ADR-0036）
 */
export const requireAuthor = async (): Promise<Author> => {
  const author = await getCurrentAuthor();
  if (!author) forbidden();
  return author;
};
