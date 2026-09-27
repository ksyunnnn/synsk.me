import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { createNote, createPublishedNote, noteFields, uniqueSlug } from './support/note';

/**
 * 作り手が確認の画面を経て note を削除する（specs/005-note-write-and-read/spec.md の
 * User Story 3）。
 *
 * すべての画面と操作が JavaScript なしで動くことを求めるため、JavaScript を切って行う。
 * 状態コードと、書き込まないことは結合テストが持つ。
 */

test.use({ javaScriptEnabled: false });

test.beforeEach(async ({ context }) => {
  await actAsAuthor(context);
});

test('確認の画面を経て削除すると、訪問者に note がないことが伝わり、同じ slug で作れる', async ({
  page,
  browser,
}) => {
  const slug = uniqueSlug('delete');
  const title = `削除する題 ${slug}`;
  const editUrl = await createPublishedNote(page, { slug, title, body: '削除する本文' });

  const visitor = await browser.newContext({ javaScriptEnabled: false });
  const visitorPage = await visitor.newPage();

  // 確認の画面から戻るリンクで戻ると、削除されない
  await page.getByRole('link', { name: 'この note を削除する' }).click();
  await expect(page).toHaveURL(`${editUrl}/delete`);
  await expect(page.getByText(`slug: ${slug}`)).toBeVisible();
  await expect(page.getByText(`題: ${title}`)).toBeVisible();
  await page.getByRole('link', { name: '編集の画面へ戻る' }).click();
  await expect(page).toHaveURL(editUrl);

  await page.goto('/dash');
  await expect(page.getByRole('listitem').filter({ hasText: slug })).toHaveCount(1);
  await visitorPage.goto(`/notes/${slug}`);
  await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();

  // 確認の画面で削除する
  await page.goto(editUrl);
  await page.getByRole('link', { name: 'この note を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  // 一覧から消え、削除したことが出る
  await expect(page).toHaveURL(/\/dash\?deleted=1$/);
  await expect(page.getByText('note を削除しました')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: slug })).toHaveCount(0);

  // 訪問者に note がないことが伝わる
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { name: 'note が見つかりません' })).toBeVisible();
  await expect(visitorPage.getByText(title)).toHaveCount(0);
  await visitor.close();

  // 同じ slug で作れる
  await createNote(page, { slug, title: '同じ slug で作り直した題', body: '' });
  await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);
});

test('別のページで削除した note を保存すると、存在しないことが出る', async ({ page, context }) => {
  const slug = uniqueSlug('deleted-elsewhere');
  await createNote(page, { slug, title: '削除される前の題', body: '本文' });
  await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);
  const editUrl = page.url();

  const other = await context.newPage();
  await other.goto(`${editUrl}/delete`);
  await other.getByRole('button', { name: '削除する' }).click();
  await expect(other).toHaveURL(/\/dash\?deleted=1$/);
  await other.close();

  await noteFields(page).title.fill('削除された後に書き換えた題');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('この note は存在しません')).toBeVisible();
});
