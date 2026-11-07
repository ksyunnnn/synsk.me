import { expect } from 'vitest';
import type { TestServer } from './d1';
import { encodeActionCall, readActionFields } from './form';

/**
 * 職務経歴書の結合の検査の道具。設定の画面は状態と設定の 2 つのフォームを持つため、何番目の
 * フォームの操作を送るかを選べるようにする。`tests/integration/support/send.ts` の `sendForm` と
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

/** 鍵を含む URL の経路から、識別子と鍵を取り出す */
export const parseLimitedUrl = (url: string) => {
  const match = /\/resume\/([a-z0-9-]+)\/([A-Za-z0-9_-]{43})$/.exec(url);
  if (!match) throw new Error(`限定公開用の URL の形でない: ${url}`);
  return { path: `/resume/${match[1]}/${match[2]}`, slug: match[1], key: match[2] };
};
