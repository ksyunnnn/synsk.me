import { expect, test, type Request } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { MEDIA_MAX_BYTES } from '../../src/shared/domain/media';
import { textbox } from './support/dash';

/**
 * ブラウザのフォームの送信と Server Action の呼び出しが、`Content-Length` を付けること。
 * Worker の入口は、`/dash` の外への `Content-Length` の無い POST を 411 で拒む
 * （src/shared/server/post-limit.ts）。付けないブラウザがあると、正しい送信まで止まる
 */

const contentLengthOf = async (request: Request) =>
  (await request.allHeaders())['content-length'] ?? null;

test('JavaScript が動いた後の Server Action の呼び出しは Content-Length を付ける', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/skills/new');
  const name = `E2E-Length-${crypto.randomUUID()}`;
  await expect
    .poll(async () => {
      await textbox(page, '名前').fill(name);
      return page.evaluate(() =>
        Object.keys(window.localStorage).some((key) => key.startsWith('synsk:draft:skill:')),
      );
    })
    .toBe(true);
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.getByRole('button', { name: '登録する' }).click(),
  ]);
  expect((await request.allHeaders())['next-action'] ?? null).not.toBeNull();
  expect(await contentLengthOf(request)).toMatch(/^\d+$/);
});

test('JavaScript なしのフォームの送信は Content-Length を付ける', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await actAsAuthor(context);
    const page = await context.newPage();
    await page.goto('/dash/skills/new');
    await textbox(page, '名前').fill(`E2E-Length-NoJs-${crypto.randomUUID()}`);
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.method() === 'POST'),
      page.getByRole('button', { name: '登録する' }).click(),
    ]);
    expect(await contentLengthOf(request)).toMatch(/^\d+$/);
  } finally {
    await context.close();
  }
});

/** 作り物の 1×1 の PNG を、上限の 10 MB（MEDIA_MAX_BYTES）まで 0 で埋めたもの */
const pngOfMaxSize = () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  return Buffer.concat([png, Buffer.alloc(MEDIA_MAX_BYTES - png.length)]);
};

test('画像を含む Server Action の呼び出しは Content-Length を付け、/dash では 10 MB の画像を登録できる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = `e2e-length-${crypto.randomUUID()}`;
  await page.goto('/dash/life-events/new');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 本文の長さの出来事');
  await page.getByRole('textbox', { name: '起きた日', exact: true }).fill('2018-01-01');
  await page.getByRole('textbox', { name: '識別子', exact: true }).fill(slug);
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await page
    .getByLabel('画像のファイル')
    .setInputFiles({ name: 'max.png', mimeType: 'image/png', buffer: pngOfMaxSize() });
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.getByRole('button', { name: '画像を登録する' }).click(),
  ]);
  expect(Number(await contentLengthOf(request))).toBeGreaterThan(MEDIA_MAX_BYTES);
  await expect(page.getByRole('status')).toHaveText('代表画像を登録しました');
});
