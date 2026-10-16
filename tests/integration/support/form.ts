import { encodeReply } from 'react-server-dom-webpack/client.edge';

/**
 * ブラウザがフォームを送るのと同じ要求を、結合テストから組み立てる。
 *
 * Server Action を `<form action>` に渡すと、React は操作を指す hidden の入力
 * （名前が `$ACTION_` で始まる）をフォームの中に描画する。JavaScript なしのブラウザは
 * 入力した値とともにそれを multipart で、画面と同じ経路へ POST する。
 */

const decodeEntities = (value: string) =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const readAttributes = (tag: string) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w$:-]+)="([^"]*)"/g)].map(([, name, value]) => [
      name,
      decodeEntities(value),
    ]),
  );

/** HTML の中の最初のフォームから、操作を指す hidden の入力を取り出す */
export const readActionFields = (html: string): Record<string, string> => {
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0];
  if (!form) throw new Error('フォームがない');
  const fields: Record<string, string> = {};
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    const { name, value = '' } = readAttributes(tag);
    if (name?.startsWith('$ACTION_')) fields[name] = value;
  }
  if (Object.keys(fields).length === 0) throw new Error('操作を指す hidden の入力がない');
  return fields;
};

/**
 * 操作を指す入力と、入力した値を、ブラウザが送るのと同じ multipart の本文にする。
 * `createTestHarness()` の `fetch` に `FormData` をそのまま渡すと、`content-type` に
 * multipart の boundary が付かず、vinext が Server Action の送信と見なさない。
 * 本文とヘッダを先に組み立てて渡す
 */
export const encodeForm = async (
  actionFields: Record<string, string>,
  values: Record<string, string | number>,
) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(actionFields)) form.append(name, value);
  for (const [name, value] of Object.entries(values)) form.append(name, String(value));
  const encoded = new Response(form);
  return {
    body: await encoded.arrayBuffer(),
    contentType: encoded.headers.get('content-type') ?? '',
  };
};

/** 操作を指す hidden の入力から、Server Action の id と、`useActionState` が渡す直前の状態を取り出す */
const readBoundAction = (actionFields: Record<string, string>) => {
  const reference = Object.entries(actionFields).find(([name]) => /^\$ACTION_\d+:0$/.test(name));
  const bound = Object.entries(actionFields).find(([name]) => /^\$ACTION_\d+:1$/.test(name));
  if (!reference || !bound) throw new Error('Server Action の id と状態がない');
  const { id } = JSON.parse(reference[1]) as { id: string };
  const [previousState] = JSON.parse(bound[1]) as [unknown];
  return { id, previousState };
};

/**
 * JavaScript のあるブラウザがフォームを送るのと同じ要求を組み立てる。
 * ハイドレーションの後、React は Server Action を `x-rsc-action` のヘッダで呼び、
 * 引数（直前の状態と入力した値）を `encodeReply` で本文にする
 * （`vinext/dist/server/app-browser-server-action-client.js` の `invokeClientServerAction`）
 */
export const encodeActionCall = async (
  actionFields: Record<string, string>,
  values: Record<string, string | number>,
) => {
  const { id, previousState } = readBoundAction(actionFields);
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.append(name, String(value));
  const encoded = new Response(await encodeReply([previousState, form]));
  return {
    body: await encoded.arrayBuffer(),
    headers: {
      'content-type': encoded.headers.get('content-type') ?? '',
      rsc: '1',
      'x-rsc-action': id,
      'next-action': id,
    },
  };
};
