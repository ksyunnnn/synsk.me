import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { saveEdit, submitAndWait, tabTo, textbox } from './support/dash';

/**
 * オーナーとしての note の作成・保存・公開（specs/003-note/spec.md の User Story 1、FR-001・
 * FR-003・FR-011、constitution V）。HTTP の状態コードと D1 の行は結合と workerd の検査が持つ。
 * 訪問者のページは、本文を描く共有担当の Markdown の部品を待つ（tasks.md の T021）。
 *
 * テストは同じ手元の D1 を並行して使う。識別子は、ほかのテストと重ならない値にする
 */

const uniqueSlug = (label: string) => `e2e-${label}-${crypto.randomUUID().slice(0, 8)}`;

/** note を作り、編集の画面に移ったことを確かめる。編集の画面の URL を返す */
const createNote = async (page: Page, { slug, title }: { slug: string; title: string }) => {
  await page.goto('/dash/notes/new');
  await textbox(page, '識別子').fill(slug);
  await textbox(page, '題').fill(title);
  await textbox(page, '本文').fill('E2E の本文');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  return page.url().replace(/\?.*$/, '');
};

test('note を作って保存し、公開すると識別子が読み取りだけになる', async ({ page, context }) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('publish');
  await createNote(page, { slug, title: 'E2E の note の題' });
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
  await expect(textbox(page, '識別子')).toBeEditable();

  await textbox(page, '本文').fill('E2E の直した本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E の直した本文');

  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('status')).toHaveText('公開しました');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
  await expect(textbox(page, '識別子')).not.toBeEditable();
  await expect(page.getByRole('link', { name: '訪問者に見せるページを開く' })).toHaveAttribute(
    'href',
    `/notes/${slug}`,
  );

  await page.goto('/dash/notes');
  await expect(page.getByRole('link', { name: 'E2E の note の題' })).toBeVisible();
});

test('題が空の note は公開できず、題を入れるよう示される（FR-011）', async ({ page, context }) => {
  await actAsAuthor(context);
  await createNote(page, { slug: uniqueSlug('untitled'), title: '' });
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('alert')).toContainText('題が空の版は公開できません');
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
});

test('キーボードだけで note を作り、保存し、公開できる（constitution V）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('keyboard');
  await page.goto('/dash/notes/new');

  await tabTo(page, textbox(page, '識別子'));
  await page.keyboard.type(slug);
  await tabTo(page, textbox(page, '題'), 5);
  await page.keyboard.type('E2E のキーボードの題');
  await tabTo(page, textbox(page, '本文'), 5);
  await page.keyboard.type('E2E のキーボードの本文');
  await tabTo(page, page.getByRole('button', { name: '作る' }), 5);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await tabTo(page, textbox(page, '本文'));
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('E2E のキーボードの本文、足した');
  await tabTo(page, page.getByRole('button', { name: '保存する' }), 5);
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(textbox(page, '本文')).toHaveValue('E2E のキーボードの本文、足した');

  await tabTo(page, page.getByRole('button', { name: '最も新しい版を公開する' }));
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
});
