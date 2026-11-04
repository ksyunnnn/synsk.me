import { expect } from 'vitest';
import type { TestServer } from './d1';
import { encodeActionCall, encodeForm, readActionFields } from './form';

/**
 * 作り手として画面を開いてフォームの操作を取り出し、ブラウザと同じ形で送る。
 * `how` が `submit` なら JavaScript なしの送信、`call` ならハイドレーションの後の呼び出し。
 * `to` を省くと、フォームのある画面へ送る。Server Action は経路に縛られないため、`/dash` の
 * 外へ送って、Server Action が自分で作り手を確かめることを確かめられる
 */
export const sendForm = async (
  ctx: TestServer,
  {
    how,
    formPath,
    to = formPath,
    values,
    asAuthor,
  }: {
    how: 'submit' | 'call';
    formPath: string;
    to?: string;
    values: Record<string, string | number>;
    asAuthor: boolean;
  },
) => {
  const page = await ctx.server.fetch(formPath, {
    headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
  });
  expect(page.status).toBe(200);
  const fields = readActionFields(await page.text());
  const headers: Record<string, string> = asAuthor
    ? { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() }
    : {};

  if (how === 'submit') {
    const { body, contentType } = await encodeForm(fields, values);
    return ctx.server.fetch(to, {
      method: 'POST',
      body,
      headers: { ...headers, 'content-type': contentType },
      redirect: 'manual',
    });
  }
  const request = await encodeActionCall(fields, values);
  return ctx.server.fetch(to, {
    method: 'POST',
    body: request.body,
    headers: { ...headers, ...request.headers },
    redirect: 'manual',
  });
};

/** 表の行をすべて id の順に読む。操作の前後で行が変わらないことを確かめるのに使う */
export const readRows = async (ctx: TestServer, table: string) =>
  (await ctx.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results;
