/**
 * JavaScript なしのブラウザがフォームを送るのと同じ要求を、結合テストから組み立てる。
 *
 * Server Action を `<form action>` に渡すと、React は操作を指す hidden の入力
 * （名前が `$ACTION_` で始まる）をフォームの中に描画する。ブラウザは入力した値と
 * ともにそれを multipart で、画面と同じ経路へ POST する。
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

/** 操作を指す入力と、入力した値を、ブラウザが送るのと同じ multipart の本文にする */
export const toFormBody = (
  actionFields: Record<string, string>,
  values: Record<string, string | number>,
) => {
  const body = new FormData();
  for (const [name, value] of Object.entries(actionFields)) body.append(name, value);
  for (const [name, value] of Object.entries(values)) body.append(name, String(value));
  return body;
};
