import { devices, expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { textbox } from './support/dash';
import { uniqueNoteSlug, waitForHydration } from './support/note';

/**
 * スマートフォンの端末の設定で、note を作り、保存し、公開する（specs/003-note/spec.md の FR-022・
 * SC-006、research.md の R16、constitution V）。画面の幅と触れる操作は Playwright の端末の設定の
 * Pixel 7（Chromium）で揃える
 */

test.use({ ...devices['Pixel 7'] });

test('スマートフォンで note を作り、保存し、公開できる', async ({ page, context }) => {
  await actAsAuthor(context);
  const slug = uniqueNoteSlug('mobile');
  await page.goto('/dash/notes/new');
  await waitForHydration(textbox(page, '本文'));

  await textbox(page, '識別子').tap();
  await textbox(page, '識別子').fill(slug);
  await textbox(page, '題').tap();
  await textbox(page, '題').fill(`E2E のスマートフォンの題 ${slug}`);
  await textbox(page, '本文').tap();
  await textbox(page, '本文').fill('E2E のスマートフォンの本文');
  await page.getByRole('button', { name: '作る' }).tap();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await waitForHydration(textbox(page, '本文'));

  await textbox(page, '本文').tap();
  await textbox(page, '本文').fill('E2E のスマートフォンで直した本文');
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.getByRole('button', { name: '保存する' }).tap(),
  ]);
  await expect(textbox(page, '本文')).toHaveValue('E2E のスマートフォンで直した本文');

  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.getByRole('button', { name: '最も新しい版を公開する' }).tap(),
  ]);
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();

  // 画面の幅に収まり、横に動かさずに操作できる
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
