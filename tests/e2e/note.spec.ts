import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { openVisitor, submitAndWait, visit } from './support/dash';

/**
 * オーナーとしての note の作成から公開・下書きに戻す・削除・戻す・過去の版に戻すまでと、
 * 2 つの画面の保存の衝突、書きかけの内容の保持、スマートフォンの幅、キーボードだけの操作
 * （specs/003-note/spec.md の User Story 1〜5、FR-018〜FR-022・SC-002・SC-006）。
 * HTTP の状態コードと応答の中身は結合の検査（tests/integration/notes.test.ts）が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。識別子と題は、ほかのテストと重ならない値にする
 */

const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

/** note を作り、編集の画面に移ったことを確かめる。編集の画面の URL を返す */
const createNote = async (page: Page, slug: string, title: string, body = '') => {
  await page.goto('/dash/notes/new');
  await textbox(page, '識別子').fill(slug);
  await textbox(page, '題').fill(title);
  await textbox(page, '本文').fill(body);
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByText('note を作りました。下書きです')).toBeVisible();
  return page.url().replace(/\?.*$/, '');
};

/** 編集の画面で本文を書き換えて保存し、保存した版の番号の知らせを待つ */
const saveBody = async (page: Page, body: string, revision: number) => {
  await textbox(page, '本文').fill(body);
  await submitAndWait(page, '保存する');
  await expect(page.getByText(`保存しました（版 ${revision}）`)).toBeVisible();
};

test('note を作って公開し、直した内容は公開し直すまで訪問者に見えず、下書きに戻す・削除・戻すができる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const slug = 'e2e-note-lifecycle';
  await createNote(page, slug, 'E2E の note の題', 'E2E の 1 つ目の本文');

  const visitor = await openVisitor(browser);
  // 下書きは訪問者に見えない（User Story 1 の 1）
  expect(await visit(visitor, `/notes/${slug}`)).toBe(404);

  await submitAndWait(page, '公開する');
  await expect(page.getByText('最新の版を公開しました')).toBeVisible();
  expect(await visit(visitor, `/notes/${slug}`)).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E の note の題');
  await expect(visitor.getByText('E2E の 1 つ目の本文')).toBeVisible();

  // 公開した後に直して保存しても、公開し直すまで訪問者には前の本文（User Story 1 の 4）
  await saveBody(page, 'E2E の 2 つ目の本文', 2);
  await visitor.reload();
  await expect(visitor.getByText('E2E の 1 つ目の本文')).toBeVisible();
  await expect(visitor.getByText('E2E の 2 つ目の本文')).toHaveCount(0);

  // 公開した note の識別子は変えられない（User Story 1 の 6）
  await expect(textbox(page, '識別子')).toHaveAttribute('readonly', '');

  await submitAndWait(page, '最新の版を公開し直す');
  await visitor.reload();
  await expect(visitor.getByText('E2E の 2 つ目の本文')).toBeVisible();

  // 下書きに戻す（User Story 2 の 1）
  await submitAndWait(page, '下書きに戻す');
  await expect(page.getByText('下書きに戻しました。訪問者には見えません')).toBeVisible();
  expect(await visit(visitor, `/notes/${slug}`)).toBe(404);

  // 公開し直してから削除し、戻すと公開に戻る（User Story 2 の 3・5）
  await submitAndWait(page, '公開する');
  await page.getByRole('link', { name: 'この note を削除する' }).click();
  await submitAndWait(page, '削除する');
  await expect(page.getByText(/note を削除しました/)).toBeVisible();
  expect(await visit(visitor, `/notes/${slug}`)).toBe(404);
  await page.getByRole('link', { name: 'E2E の note の題' }).click();
  await submitAndWait(page, '削除を戻す');
  await expect(page.getByText('削除を戻しました')).toBeVisible();
  expect(await visit(visitor, `/notes/${slug}`)).toBe(200);
  await expect(visitor.getByText('E2E の 2 つ目の本文')).toBeVisible();
  await visitor.close();
});

test('過去の版に戻すと、その版の中身が新しい版として保存される（User Story 3）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, 'e2e-note-revisions', 'E2E 版の題', 'E2E 版 1 の本文');
  await saveBody(page, 'E2E 版 2 の本文', 2);
  await saveBody(page, 'E2E 版 3 の本文', 3);

  await page.getByRole('link', { name: '版の一覧' }).click();
  await expect(page.getByRole('link', { name: /^版 \d+:/ })).toHaveCount(3);
  await page.getByRole('link', { name: '版 1: E2E 版の題' }).click();
  await expect(page.getByText('E2E 版 1 の本文').first()).toBeVisible();
  await submitAndWait(page, 'この版に戻す');
  await expect(page.getByText(/過去の版に戻し、新しい版として保存しました/)).toBeVisible();
  expect(page.url()).toContain(editUrl);
  await expect(textbox(page, '本文')).toHaveValue('E2E 版 1 の本文');
  await expect(page.getByText('版 4', { exact: true })).toBeVisible();
});

test('2 つの画面で同じ note を保存すると、後の保存は止まり、その画面の内容が残る（SC-002）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, 'e2e-note-conflict', 'E2E 衝突の題');
  const other = await context.newPage();
  await other.goto(editUrl);

  await saveBody(page, 'E2E 画面 A の本文', 2);
  // 続けてもう一度保存できる（User Story 4 の 4）
  await saveBody(page, 'E2E 画面 A の 2 回目の本文', 3);

  await textbox(other, '本文').fill('E2E 画面 B の本文');
  await submitAndWait(other, '保存する');
  await expect(other.getByRole('alert')).toContainText('別の画面で保存されていました');
  await expect(textbox(other, '本文')).toHaveValue('E2E 画面 B の本文');

  // 同じ端末の画面 A を開き直すと、画面 B の書きかけが戻り、古い版から書き始めたことを示す。
  // 捨てると、保存されている最新の版（画面 A の 2 回目）になる
  await page.reload();
  await expect(page.getByText(/この書きかけは版 1 から書き始めたものです/)).toBeVisible();
  await page.getByRole('button', { name: '書きかけを捨てる' }).click();
  await expect(textbox(page, '本文')).toHaveValue('E2E 画面 A の 2 回目の本文');
  await other.close();
});

test('保存していない書きかけは同じ端末に残り、保存すると消える（User Story 4 の 1）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await createNote(page, 'e2e-note-draft', 'E2E 書きかけの題');
  await textbox(page, '本文').fill('E2E 保存していない書きかけ');
  await page.reload();
  await expect(
    page.getByText('保存していない書きかけの内容を、この端末から戻しました。'),
  ).toBeVisible();
  await expect(textbox(page, '本文')).toHaveValue('E2E 保存していない書きかけ');

  await submitAndWait(page, '保存する');
  await expect(page.getByText('保存しました（版 2）')).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('保存していない書きかけの内容を、この端末から戻しました。'),
  ).toHaveCount(0);
  await expect(textbox(page, '本文')).toHaveValue('E2E 保存していない書きかけ');
});

test('本文に画像を置いて公開すると、訪問者に画像が出る（User Story 5 の 1）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await createNote(page, 'e2e-note-image', 'E2E 画像の題');
  // 1×1 の PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.getByLabel('画像のファイル').setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await submitAndWait(page, '画像を追加する');
  const snippet = page.getByText(/^!\[\]\(media:.+\.png\)$/).first();
  await expect(snippet).toBeVisible();
  const markdown = (await snippet.textContent()) as string;
  await saveBody(page, `E2E 画像の本文\n\n${markdown}`, 2);
  await submitAndWait(page, '公開する');

  const visitor = await openVisitor(browser);
  const image = visitor.waitForResponse((res) =>
    res.url().includes('/notes/e2e-note-image/images/'),
  );
  await visitor.goto('/notes/e2e-note-image');
  expect((await image).status()).toBe(200);
  await visitor.close();
});

test.describe('スマートフォンの幅', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('note を作り、保存し、公開できる（SC-006）', async ({ page, context, browser }) => {
    await actAsAuthor(context);
    await createNote(page, 'e2e-note-mobile', 'E2E スマートフォンの題', 'E2E スマートフォンの本文');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
    await submitAndWait(page, '公開する');
    const visitor = await openVisitor(browser);
    expect(await visit(visitor, '/notes/e2e-note-mobile')).toBe(200);
    await visitor.close();
  });
});

test('キーボードだけで note を作れる（constitution V）', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/notes/new');
  // 先頭から Tab で識別子の入力まで進む
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'slug') break;
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute('name'))).toBe('slug');
  await page.keyboard.type('e2e-note-keyboard');
  await page.keyboard.press('Tab');
  await page.keyboard.type('E2E キーボードの題');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('E2E キーボードの本文');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByText('note を作りました。下書きです')).toBeVisible();
  await expect(textbox(page, '題')).toHaveValue('E2E キーボードの題');
});
