import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { registerProject } from './support/dash';
import { createNote, uniqueNoteSlug } from './support/note';

/**
 * 管理画面の基本の操作が分かること（issue #219 の 2026-11-11 の宣言）。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const uniqueTitle = (label: string) => `E2E ${label} ${crypto.randomUUID()}`;

test.describe('保存のボタン', () => {
  test('長い入力の画面を開くと、下までスクロールしなくても保存のボタンが見える', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E 保存のボタンの組織',
      organizationNameMasked: 'E2E 保存のボタンの秘匿化した組織名',
      title: uniqueTitle('保存のボタン'),
    });
    const noteUrl = await createNote(page, {
      slug: uniqueNoteSlug('save-button'),
      title: 'E2E 保存のボタンの note',
    });

    for (const [url, button] of [
      [editUrl, '保存する'],
      ['/dash/projects/new', '登録する'],
      ['/dash/careers/new', '登録する'],
      [noteUrl, '保存する'],
    ] as const) {
      await page.goto(url);
      await expect(page.getByRole('button', { name: button, exact: true })).toBeInViewport();
    }
  });

  test('スマートフォンの幅でも、開いた時点で保存のボタンが見える', async ({ page, context }) => {
    await actAsAuthor(context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dash/projects/new');
    await expect(page.getByRole('button', { name: '登録する', exact: true })).toBeInViewport();
  });
});

test.describe('フォームの区切り', () => {
  test('実績と note の編集の画面で、内容の保存のボタンは、画像や転載先の操作と別の区切りにある', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E フォームの区切りの組織',
      organizationNameMasked: 'E2E フォームの区切りの秘匿化した組織名',
      title: uniqueTitle('フォームの区切り'),
    });
    await page.goto(editUrl);
    const content = page.getByRole('region', { name: '内容', exact: true });
    await expect(content.getByRole('button', { name: '保存する', exact: true })).toBeVisible();
    await expect(content.getByRole('button', { name: '画像を足す' })).toHaveCount(0);
    await expect(content.getByRole('button', { name: '代表画像を選び直す' })).toHaveCount(0);

    const noteUrl = await createNote(page, {
      slug: uniqueNoteSlug('form-sections'),
      title: 'E2E フォームの区切りの note',
    });
    await page.goto(noteUrl);
    const noteContent = page.getByRole('region', { name: '内容', exact: true });
    await expect(noteContent.getByRole('button', { name: '保存する', exact: true })).toBeVisible();
    await expect(noteContent.getByRole('button', { name: '転載先を記録する' })).toHaveCount(0);
    await expect(noteContent.getByRole('button', { name: '画像を足す' })).toHaveCount(0);
  });
});
