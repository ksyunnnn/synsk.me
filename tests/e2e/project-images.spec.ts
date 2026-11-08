import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  fillProject,
  openVisitor,
  readProjectPath,
  registerProject,
  saveEdit,
  submitAndWait,
  visit,
} from './support/dash';

/**
 * オーナーが実績に画像を足して本文に貼り、代表画像を選ぶ。秘匿化しない実績では訪問者に画像が
 * 出て、秘匿化に切り替えると出なくなる（specs/001-career-and-project/spec.md の FR-027・FR-028・
 * FR-030）。HTTP の状態コードと応答の中身は結合の検査（tests/integration/project-images.test.ts）が
 * 持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする
 */

// 1×1 の PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('実績に画像を足して本文に貼り、代表画像を選ぶと、秘匿化しない間だけ訪問者に画像が出る', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const { editUrl, path } = await registerProject(page, {
    organizationName: 'E2E 実績の組織 画像',
    organizationNameMasked: 'E2E 実績の秘匿化した組織 画像',
    title: 'E2E 実績の題 画像',
    isMasked: false,
    onSite: true,
  });

  await page.getByLabel('画像のファイル').setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await submitAndWait(page, '画像を追加する');
  await expect(page.getByRole('status').filter({ hasText: '画像を追加しました' })).toBeVisible();
  const snippet = page.getByText(/^!\[\]\(media:.+\.png\)$/).first();
  await expect(snippet).toBeVisible();
  const markdown = (await snippet.textContent()) as string;
  const caption = 'E2E 実績の画像のキャプション';

  // 追加の知らせを残したまま保存すると、保存の知らせと見分けにくい。開き直してから書く
  await page.goto(editUrl);
  await fillProject(page, {
    description: `E2E 実績の本文\n\n${markdown.replace(')', ` "${caption}")`)}`,
  });
  await saveEdit(page);

  // 代表画像はキーボードだけで選ぶ（constitution V）
  await page.getByRole('radio', { name: /実績の画像 1/ }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: '代表画像を選ぶ' }).focus();
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(page.getByRole('status').filter({ hasText: '代表画像を選びました' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /実績の画像 1/ })).toBeChecked();

  const visitor = await openVisitor(browser);
  const image = visitor.waitForResponse((res) => res.url().includes(`${path}/images/`));
  expect(await visit(visitor, path)).toBe(200);
  expect((await image).status()).toBe(200);
  await expect(visitor.getByText(caption)).toBeVisible();
  await expect(visitor.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    new RegExp(`${path}/images/`),
  );

  // 秘匿化に切り替えると、識別子が変わり、画像も本文も出ない（FR-013・FR-030）
  await page.goto(editUrl);
  await page.getByRole('radio', { name: '秘匿化する', exact: true }).check();
  await saveEdit(page);
  const link = page.getByRole('link', { name: '訪問者に見せるページを開く' });
  await expect(link).not.toHaveAttribute('href', path);
  const maskedPath = await readProjectPath(page, /^\/projects\/[0-9a-f-]{36}$/);
  expect(await visit(visitor, path)).toBe(404);
  expect(await visit(visitor, maskedPath)).toBe(200);
  await expect(visitor.getByText(caption)).toHaveCount(0);
  await expect(visitor.locator('main img')).toHaveCount(0);
  await visitor.close();
});
