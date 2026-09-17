import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { createNote, fitsViewportWidth, noteFields, tabTo, uniqueSlug } from './support/note';

/**
 * 作り手の操作を、キーボードだけで、また幅 360px の画面で行えること
 * （specs/005-note-write-and-read/spec.md の FR-017）。
 */

test.beforeEach(async ({ context }) => {
  await actAsAuthor(context);
});

test.describe('キーボードだけ', () => {
  test('作って公開する', async ({ page }) => {
    const slug = uniqueSlug('keyboard');

    await page.goto('/dash');
    await tabTo(page, page.getByRole('link', { name: '新しい note を作る' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dash\/notes\/new$/);

    const fields = noteFields(page);
    await tabTo(page, fields.slug);
    await page.keyboard.type(slug);
    await tabTo(page, fields.title);
    await page.keyboard.type('キーボードで書いた題');
    await tabTo(page, fields.body);
    await page.keyboard.type('キーボードで書いた本文');
    await tabTo(page, page.getByRole('button', { name: '作る' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    await tabTo(page, page.getByRole('button', { name: '公開する' }));
    await page.keyboard.press('Enter');
    await expect(page.getByText('公開しました')).toBeVisible();
    // 画面を読み込み直さなくても、公開済みの note の呼び名に変わる
    await expect(page.getByRole('button', { name: '公開し直す' })).toBeVisible();
  });

  test('保存する', async ({ page }) => {
    const slug = uniqueSlug('keyboard-save');
    await createNote(page, { slug, title: 'キーボードで保存する前の題', body: '本文' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    const fields = noteFields(page);
    await tabTo(page, fields.title);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('キーボードで保存した題');
    await tabTo(page, page.getByRole('button', { name: '保存する' }));
    await page.keyboard.press('Enter');
    await expect(page.getByText('保存しました')).toBeVisible();

    await page.reload();
    await expect(fields.title).toHaveValue('キーボードで保存した題');
  });

  test('確認の画面を経て削除する', async ({ page }) => {
    const slug = uniqueSlug('keyboard-delete');
    await createNote(page, { slug, title: 'キーボードで削除する題', body: '本文' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    await tabTo(page, page.getByRole('link', { name: 'この note を削除する' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dash\/notes\/\d+\/delete$/);

    await tabTo(page, page.getByRole('button', { name: '削除する' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dash\?deleted=1$/);
    await expect(page.getByText('note を削除しました')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: slug })).toHaveCount(0);
  });
});

test.describe('幅 360px の画面', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test('作って公開する', async ({ page }) => {
    const slug = uniqueSlug('narrow');

    await createNote(page, { slug, title: '狭い画面で書いた題', body: '狭い画面で書いた本文' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);
    expect(await fitsViewportWidth(page)).toBe(true);

    await page.getByRole('button', { name: '公開する' }).tap();
    await expect(page.getByText('公開しました')).toBeVisible();
    expect(await fitsViewportWidth(page)).toBe(true);

    await page.goto('/dash/notes/new');
    expect(await fitsViewportWidth(page)).toBe(true);
    await page.goto('/dash');
    expect(await fitsViewportWidth(page)).toBe(true);
  });

  test('保存する', async ({ page }) => {
    const slug = uniqueSlug('narrow-save');
    await createNote(page, { slug, title: '狭い画面で保存する前の題', body: '本文' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    const fields = noteFields(page);
    await fields.title.tap();
    await fields.title.fill('狭い画面で保存した題');
    await page.getByRole('button', { name: '保存する' }).tap();
    await expect(page.getByText('保存しました')).toBeVisible();
    expect(await fitsViewportWidth(page)).toBe(true);

    await page.reload();
    await expect(fields.title).toHaveValue('狭い画面で保存した題');
  });
  test('確認の画面を経て削除する', async ({ page }) => {
    const slug = uniqueSlug('narrow-delete');
    await createNote(page, { slug, title: '狭い画面で削除する題', body: '本文' });
    await expect(page).toHaveURL(/\/dash\/notes\/\d+$/);

    await page.getByRole('link', { name: 'この note を削除する' }).tap();
    await expect(page).toHaveURL(/\/dash\/notes\/\d+\/delete$/);
    expect(await fitsViewportWidth(page)).toBe(true);

    await page.getByRole('button', { name: '削除する' }).tap();
    await expect(page).toHaveURL(/\/dash\?deleted=1$/);
    await expect(page.getByText('note を削除しました')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: slug })).toHaveCount(0);
    expect(await fitsViewportWidth(page)).toBe(true);
  });
});
