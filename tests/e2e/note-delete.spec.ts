import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createNote,
  createPublishedNote,
  deletedNoteListItem,
  noteFields,
  noteListItem,
  uniqueSlug,
} from './support/note';

/**
 * 作り手が確認の画面を経て note を削除し、削除した note を戻す
 * （specs/005-note-write-and-read/spec.md の User Story 3）。
 *
 * すべての画面と操作が JavaScript なしで動くことを求めるため、JavaScript を切って行う。
 * 状態コードと、書き込まないことは結合テストが持つ。
 */

test.use({ javaScriptEnabled: false });

test.beforeEach(async ({ context }) => {
  await actAsAuthor(context);
});

test('確認の画面を経て削除すると訪問者に note がないことが伝わり、公開で戻すと再び読める', async ({
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
  await expect(noteListItem(page, slug)).toHaveCount(1);
  await visitorPage.goto(`/notes/${slug}`);
  await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();

  // 確認の画面で削除する
  await page.goto(editUrl);
  await page.getByRole('link', { name: 'この note を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();

  // note の一覧から外れて削除した note の一覧に並び、削除したことが出る
  await expect(page).toHaveURL(/\/dash\?deleted=1$/);
  await expect(page.getByText('note を削除しました')).toBeVisible();
  await expect(noteListItem(page, slug)).toHaveCount(0);
  await expect(deletedNoteListItem(page, slug)).toHaveCount(1);
  await expect(deletedNoteListItem(page, slug).getByText('削除する前の状態: 公開')).toBeVisible();

  // 訪問者に note がないことが伝わる
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { name: 'note が見つかりません' })).toBeVisible();
  await expect(visitorPage.getByText(title)).toHaveCount(0);

  // 削除した note の編集の画面は開けない
  await page.goto(editUrl);
  await expect(page.getByText('この note は存在しません')).toBeVisible();

  // 削除した note の slug では作れない
  await createNote(page, { slug, title: '同じ slug で作ろうとした題', body: '' });
  await expect(page.getByText('削除した note の slug も使えません')).toBeVisible();

  // 確認の画面を経て戻す
  await page.goto('/dash');
  await deletedNoteListItem(page, slug).getByRole('link', { name: 'この note を戻す' }).click();
  await expect(page).toHaveURL(`${editUrl}/restore`);
  await expect(page.getByText(`slug: ${slug}`)).toBeVisible();
  await expect(page.getByText('訪問者が再び読めるようになります')).toBeVisible();
  await page.getByRole('button', { name: '公開で戻す' }).click();

  // note の一覧に公開の状態で戻り、戻したことが出る
  await expect(page).toHaveURL(/\/dash\?restored=1$/);
  await expect(page.getByText('note を戻しました')).toBeVisible();
  await expect(noteListItem(page, slug).getByText('状態: 公開')).toBeVisible();
  await expect(deletedNoteListItem(page, slug)).toHaveCount(0);

  // 訪問者が、削除する前と同じ題と本文を読める
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(visitorPage.getByText('削除する本文')).toBeVisible();
  await visitor.close();
});

test('公開した note を下書きで戻すと訪問者に見えず、公開し直すと公開日は変わらない', async ({
  page,
  browser,
}) => {
  const slug = uniqueSlug('restore-draft');
  const title = `下書きで戻す題 ${slug}`;
  const editUrl = await createPublishedNote(page, { slug, title, body: '下書きで戻す本文' });

  const visitor = await browser.newContext({ javaScriptEnabled: false });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/notes/${slug}`);
  const publishedOn = await visitorPage.locator('time').textContent();

  await page.goto(`${editUrl}/delete`);
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page).toHaveURL(/\/dash\?deleted=1$/);

  // 下書きで戻す
  await page.goto(`${editUrl}/restore`);
  await expect(page.getByRole('button', { name: '公開で戻す' })).toBeVisible();
  await page.getByRole('button', { name: '下書きで戻す' }).click();
  await expect(page).toHaveURL(/\/dash\?restored=1$/);
  await expect(noteListItem(page, slug).getByText('状態: 下書き')).toBeVisible();

  // 訪問者に note がないことが伝わる
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { name: 'note が見つかりません' })).toBeVisible();
  await expect(visitorPage.getByText(title)).toHaveCount(0);

  // 一度公開した note の slug は、下書きで戻しても変えられない
  await page.goto(editUrl);
  await expect(page.getByText('公開した note の slug は変えられません')).toBeVisible();

  // 直して公開し直すと、直した題が出て、公開日は初めて公開した日のまま
  const fixedTitle = `直した題 ${slug}`;
  await noteFields(page).title.fill(fixedTitle);
  await page.getByRole('button', { name: '公開する' }).click();
  await expect(page.getByText('公開しました')).toBeVisible();

  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { level: 1, name: fixedTitle })).toBeVisible();
  await expect(visitorPage.locator('time')).toHaveText(publishedOn ?? '');
  await visitor.close();
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
