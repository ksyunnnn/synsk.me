import { expect, test, type Request } from '@playwright/test';
import { actAsAuthor } from './support/author';
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
  await actAsAuthor(context);
  const page = await context.newPage();
  await page.goto('/dash/skills/new');
  await textbox(page, '名前').fill(`E2E-Length-NoJs-${crypto.randomUUID()}`);
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.method() === 'POST'),
    page.getByRole('button', { name: '登録する' }).click(),
  ]);
  expect(await contentLengthOf(request)).toMatch(/^\d+$/);
  await context.close();
});
