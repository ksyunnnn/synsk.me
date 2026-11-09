import { expect, type Page } from '@playwright/test';
import { textbox } from './dash';

/**
 * E2E でオーナーが note の管理画面で行う操作。テストは同じ手元の D1 を並行して使うため、識別子は
 * テストごとに重ならない値にする
 */

/** ほかのテストと重ならない識別子 */
export const uniqueNoteSlug = (label: string) => `e2e-${label}-${crypto.randomUUID().slice(0, 8)}`;

/** note を作り、編集の画面に移ったことを確かめる。編集の画面の URL を返す */
export const createNote = async (
  page: Page,
  { slug, title, body = 'E2E の本文' }: { slug: string; title: string; body?: string },
) => {
  await page.goto('/dash/notes/new');
  await textbox(page, '識別子').fill(slug);
  await textbox(page, '題').fill(title);
  await textbox(page, '本文').fill(body);
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  return page.url().replace(/\?.*$/, '');
};
