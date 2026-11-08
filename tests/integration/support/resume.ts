import { expect } from 'vitest';
import type { TestServer } from './d1';
import { encodeActionCall, readActionFields } from './form';

/**
 * 職務経歴書の結合の検査の道具。設定の画面は複数のフォームを持つため（限定公開用は URL の
 * 出し直し・状態・設定の順）、何番目のフォームの操作を送るかを選べるようにする。`tests/integration/support/send.ts` の `sendForm` と
 * 同じ要求を組み立てる
 */

/** HTML の中の `index` 番目（0 から）のフォームより前を落とす */
const fromForm = (html: string, index: number) => {
  let at = -1;
  for (let i = 0; i <= index; i += 1) {
    at = html.indexOf('<form', at + 1);
    if (at < 0) throw new Error(`${index} 番目のフォームがない`);
  }
  return html.slice(at);
};

export const sendNthForm = async (
  ctx: TestServer,
  {
    how,
    formPath,
    formIndex = 0,
    to = formPath,
    values,
    asAuthor,
  }: {
    how: 'submit' | 'call';
    formPath: string;
    formIndex?: number;
    to?: string;
    values: Record<string, string | number> | [string, string | number][];
    asAuthor: boolean;
  },
) => {
  const page = await ctx.server.fetch(formPath, {
    headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
  });
  expect(page.status, formPath).toBe(200);
  const fields = readActionFields(fromForm(await page.text(), formIndex));
  const headers: Record<string, string> = asAuthor
    ? { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() }
    : {};
  // 同じ名前を複数送る入力（チェックボックス）は、組の並びで渡す
  const entries = Array.isArray(values) ? values : Object.entries(values);

  if (how === 'submit') {
    const { body, contentType } = await encodeFormEntries(fields, entries);
    return ctx.server.fetch(to, {
      method: 'POST',
      body,
      headers: { ...headers, 'content-type': contentType },
      redirect: 'manual',
    });
  }
  const request = await encodeActionCallEntries(fields, entries);
  return ctx.server.fetch(to, {
    method: 'POST',
    body: request.body,
    headers: { ...headers, ...request.headers },
    redirect: 'manual',
  });
};

/** JavaScript なしのブラウザと同じ multipart の本文。同じ名前を複数持てる */
const encodeFormEntries = async (
  fields: Record<string, string>,
  entries: [string, string | number][],
) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  for (const [name, value] of entries) form.append(name, String(value));
  const response = new Response(form);
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') ?? '',
  };
};

/** ハイドレーションの後の呼び出し。`encodeActionCall` は名前ごとに値を 1 つ持つ */
const encodeActionCallEntries = (
  fields: Record<string, string>,
  entries: [string, string | number][],
) => {
  if (new Set(entries.map(([name]) => name)).size !== entries.length) {
    throw new Error('同じ名前を複数送る呼び出しは submit で送る');
  }
  return encodeActionCall(fields, Object.fromEntries(entries));
};

/** 限定公開用の URL（`/resume/{slug}`）の経路から、識別子を取り出す */
export const parseLimitedUrl = (url: string) => {
  const match = /\/resume\/([a-z0-9-]+)$/.exec(url);
  if (!match) throw new Error(`限定公開用の URL の形でない: ${url}`);
  return { path: `/resume/${match[1]}`, slug: match[1] };
};

/** HTML に示された限定公開用の URL（`/resume/{slug}`）を探し、識別子を取り出す */
export const findLimitedUrl = (html: string) => {
  const found = /https?:\/\/[^"<\s]+\/resume\/[a-z0-9-]+(?=["<\s])/.exec(html)?.[0];
  if (!found) throw new Error('限定公開用の URL が HTML に無い');
  return parseLimitedUrl(found);
};

/** 設定の画面の、限定公開用のフォームの並び */
export const LIMITED_SETTINGS_FORMS = { url: 0, status: 1, settings: 2 } as const;
