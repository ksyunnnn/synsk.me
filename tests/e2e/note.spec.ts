import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { openVisitor, saveEdit, submitAndWait, tabTo, textbox, visit } from './support/dash';
import { createNote, uniqueNoteSlug as uniqueSlug } from './support/note';

/**
 * オーナーとしての note の作成・保存・公開（specs/003-note/spec.md の User Story 1、FR-001・
 * FR-003・FR-011、constitution V）。HTTP の状態コードと D1 の行は結合と workerd の検査が持つ
 */

test('note を作って保存し、公開すると訪問者が読め、識別子が読み取りだけになる', async ({
  page,
  context,
  browser,
}) => {
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
  await expect(textbox(page, '識別子')).toHaveCount(0);
  await expect(page.getByText(slug, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '訪問者に見せるページを開く' })).toHaveAttribute(
    'href',
    `/notes/${slug}`,
  );

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, `/notes/${slug}`)).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E の note の題');
  await expect(visitor.getByText('E2E の直した本文')).toBeVisible();
  await visitor.close();

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

test('続けて保存しても、保存できた書きかけがその端末に残らない（FR-019）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueSlug('drafts'),
    title: 'E2E の書きかけの題',
  });
  // 1 回目の保存で `?saved=1` へ移り、2 回目の保存で同じ URL へ移る形にするため、開き直す
  await page.goto(editUrl);
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
  for (const body of ['E2E の 1 回目', 'E2E の 2 回目']) {
    await textbox(page, '本文').fill(body);
    await saveEdit(page);
    await expect(textbox(page, '本文')).toHaveValue(body);
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft')),
      ),
    )
    .toEqual([]);
});

test('識別子を書きかけたまま公開すると、識別子は公開した値に戻り、続けて保存できる（FR-003）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('lock');
  await createNote(page, { slug, title: 'E2E の識別子の題' });
  await textbox(page, '識別子').fill(`${slug}-changed`);
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
  await expect(page.getByText(slug, { exact: true })).toBeVisible();

  await textbox(page, '本文').fill('E2E の公開した後の本文');
  await saveEdit(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(slug, { exact: true })).toBeVisible();
  await expect(textbox(page, '本文')).toHaveValue('E2E の公開した後の本文');
});
