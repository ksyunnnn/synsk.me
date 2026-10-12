import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { createPublishedNote, noteFields, uniqueSlug } from './support/note';

/**
 * 作り手が公開済みの note を書き換え、公開し直す（specs/005-note-write-and-read/spec.md の
 * User Story 2）。
 *
 * すべての画面と操作が JavaScript なしで動くことを求めるため、JavaScript を切って行う。
 * 状態コードと、書き込まないことは結合テストが持つ。
 */

test.use({ javaScriptEnabled: false });

test.beforeEach(async ({ context }) => {
  await actAsAuthor(context);
});

test('公開済みの note を保存し、公開し直すと訪問者に書き換えた題が出る', async ({
  page,
  browser,
}) => {
  const slug = uniqueSlug('edit');
  const title = `書き換える前の題 ${slug}`;
  const newTitle = `書き換えた題 ${slug}`;
  const editUrl = await createPublishedNote(page, { slug, title, body: '本文' });

  const visitor = await browser.newContext({ javaScriptEnabled: false });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/notes/${slug}`);
  await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  const publishedOn = await visitorPage.locator('time').textContent();

  // 公開済みの note では、slug を変えられないことが分かる
  await page.goto(editUrl);
  const fields = noteFields(page);
  await expect(page.getByText('公開した note の slug は変えられません')).toBeVisible();
  await expect(fields.slug).not.toBeEditable();
  await expect(page.getByRole('button', { name: '公開し直す' })).toBeVisible();

  // 保存する
  await fields.title.fill(newTitle);
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました')).toBeVisible();
  await expect(fields.title).toHaveValue(newTitle);

  // 訪問者には書き換える前の題が出たまま
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();

  // 一覧に、公開し直していない書き換えがあることが出る
  await page.goto('/dash');
  const item = page.getByRole('listitem').filter({ hasText: slug });
  await expect(item).toContainText('公開');
  await expect(item).toContainText('公開し直していない書き換えがあります');

  // 公開し直す
  await item.getByRole('link', { name: newTitle }).click();
  await expect(page).toHaveURL(editUrl);
  await page.getByRole('button', { name: '公開し直す' }).click();
  await expect(page.getByText('公開しました')).toBeVisible();

  // 訪問者に書き換えた題が出て、公開日は変わらない
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { level: 1, name: newTitle })).toBeVisible();
  await expect(visitorPage.locator('time')).toHaveText(publishedOn ?? '');
  await visitor.close();

  // 一覧から、公開し直していない書き換えの表示が消える
  await page.goto('/dash');
  await expect(page.getByRole('listitem').filter({ hasText: slug })).not.toContainText(
    '公開し直していない書き換えがあります',
  );
});
