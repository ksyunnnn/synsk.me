import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { createNote, noteFields, uniqueSlug } from './support/note';

/**
 * 作り手が note を作って公開し、訪問者が読む（specs/005-note-write-and-read/spec.md の
 * User Story 1）。
 *
 * すべての画面と操作が JavaScript なしで動くことを求めるため、JavaScript を切って行う。
 * 状態コードと、書き込まないことは結合テストが持つ。
 */

test.use({ javaScriptEnabled: false });

test.beforeEach(async ({ context }) => {
  await actAsAuthor(context);
});

test('作り手が作って公開し、訪問者が読む', async ({ page, browser }) => {
  const slug = uniqueSlug('publish');
  const title = `公開する題 ${slug}`;

  // 作る
  await page.goto('/dash');
  await page.getByRole('link', { name: '新しい note を作る' }).click();
  await expect(page).toHaveURL(/\/dash\/notes\/new$/);
  const fields = noteFields(page);
  await fields.slug.fill(slug);
  await fields.title.fill(title);
  await fields.body.fill('1行目\n2行目');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);
  const editUrl = page.url();

  // 一覧に下書きとして並ぶ
  await page.goto('/dash');
  const item = page.getByRole('listitem').filter({ hasText: slug });
  await expect(item).toContainText('下書き');

  // 訪問者には note がないことが伝わる
  const visitor = await browser.newContext({ javaScriptEnabled: false });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/notes/${slug}`);
  await expect(visitorPage.getByRole('heading', { name: 'note が見つかりません' })).toBeVisible();
  await expect(visitorPage.getByText(title)).toHaveCount(0);

  // 公開する
  await item.getByRole('link', { name: title }).click();
  await expect(page).toHaveURL(editUrl);
  await page.getByRole('button', { name: '公開する' }).click();
  await expect(page.getByText('公開しました')).toBeVisible();
  await expect(page.getByRole('link', { name: '公開した note を開く' })).toHaveAttribute(
    'href',
    `/notes/${slug}`,
  );

  // 訪問者が題・公開日・本文を読む
  await visitorPage.reload();
  await expect(visitorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(visitorPage.locator('time')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  await expect(visitorPage.getByText('1行目')).toBeVisible();
  await expect(visitorPage.getByText('2行目')).toBeVisible();
  await visitor.close();
});

test.describe('入力の誤り', () => {
  const expectValuesKept = async (
    page: import('@playwright/test').Page,
    values: { slug: string; title: string; body: string },
  ) => {
    const fields = noteFields(page);
    await expect(fields.slug).toHaveValue(values.slug);
    await expect(fields.title).toHaveValue(values.title);
    await expect(fields.body).toHaveValue(values.body);
  };

  test('空の slug', async ({ page }) => {
    const values = { slug: '', title: '空の slug の題', body: '空の slug の本文' };
    await createNote(page, values);
    await expect(page.getByText('slug を入力してください')).toBeVisible();
    await expectValuesKept(page, values);
  });

  test('使えない slug', async ({ page }) => {
    const values = { slug: 'Bad Slug', title: '使えない slug の題', body: '本文' };
    await createNote(page, values);
    await expect(
      page.getByText('slug は小文字の英字・数字・ハイフンで、100文字までにしてください'),
    ).toBeVisible();
    await expectValuesKept(page, values);
  });

  test('重複した slug', async ({ page }) => {
    const slug = uniqueSlug('taken');
    await createNote(page, { slug, title: '先に作った題', body: '' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    const values = { slug, title: '後から作る題', body: '後から作る本文' };
    await createNote(page, values);
    await expect(page.getByText('この slug は他の note が使っています')).toBeVisible();
    await expectValuesKept(page, values);
  });

  test('長すぎる題', async ({ page }) => {
    const values = { slug: uniqueSlug('long-title'), title: 'あ'.repeat(201), body: '本文' };
    await createNote(page, values);
    await expect(page.getByText('題は200文字までにしてください')).toBeVisible();
    await expect(page.getByText('本文は100,000文字までにしてください')).toHaveCount(0);
    await expectValuesKept(page, values);
  });

  test('長すぎる本文', async ({ page }) => {
    const values = { slug: uniqueSlug('long-body'), title: '題', body: 'a'.repeat(100_001) };
    await createNote(page, values);
    await expect(page.getByText('本文は100,000文字までにしてください')).toBeVisible();
    await expect(page.getByText('題は200文字までにしてください')).toHaveCount(0);
    await expectValuesKept(page, values);
  });

  test('空の題で公開する', async ({ page }) => {
    const slug = uniqueSlug('empty-title');
    await createNote(page, { slug, title: '', body: '題のない本文' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    await page.getByRole('button', { name: '公開する' }).click();
    await expect(page.getByText('公開するには題を入力してください')).toBeVisible();
    await expectValuesKept(page, { slug, title: '', body: '題のない本文' });
  });
});

// note が1件もない D1 で走らせる。playwright.config.ts の project `empty-db` が、
// ほかのテストが note を作る前に、これだけを走らせる
test('note が0件なら、一覧は空であることを伝える', { tag: '@empty-db' }, async ({ page }) => {
  await page.goto('/dash');
  await expect(page.getByText('note がありません')).toBeVisible();
  await expect(page.getByRole('link', { name: '新しい note を作る' })).toBeVisible();
});
