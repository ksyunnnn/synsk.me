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
});
