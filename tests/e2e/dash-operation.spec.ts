import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { registerProject, textbox } from './support/dash';
import { createNote, uniqueNoteSlug, waitForHydration } from './support/note';

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

/**
 * Server Action の POST の応答を止める。返した関数を呼ぶと、止めていた応答を流し、それ以降は
 * 止めない
 */
const holdPosts = async (page: Page) => {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*', async (route) => {
    if (route.request().method() === 'POST') await released;
    await route.fallback();
  });
  return release;
};

test.describe('送っている間', () => {
  test('保存のボタンを押すと、応答が来るまで「送っています…」になり、押せない', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E 送っている間の組織',
      organizationNameMasked: 'E2E 送っている間の秘匿化した組織名',
      title: uniqueTitle('送っている間'),
    });
    await page.goto(editUrl);
    await waitForHydration(page.locator('main form').first());
    const release = await holdPosts(page);
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    const pending = page.getByRole('button', { name: '送っています…', exact: true });
    await expect(pending).toBeDisabled();
    release();
    await expect(page.getByRole('status')).toHaveText('保存しました');
    await expect(page.getByRole('button', { name: '保存する', exact: true })).toBeEnabled();
  });
});

test.describe('失敗の位置', () => {
  test('入力の誤りで保存できないと、最初の誤りの項目へフォーカスが移り、画面に見える', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E 失敗の位置の組織',
      organizationNameMasked: 'E2E 失敗の位置の秘匿化した組織名',
      title: uniqueTitle('失敗の位置'),
    });
    await page.goto(editUrl);
    await waitForHydration(page.locator('main form').first());
    await textbox(page, '題').fill('');
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(textbox(page, '題')).toBeFocused();
    await expect(textbox(page, '題')).toBeInViewport();
  });

  test('別の画面で先に保存されていて保存できないと、理由の文言へフォーカスが移る', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E 失敗の位置の先の保存の組織',
      organizationNameMasked: 'E2E 失敗の位置の先の保存の秘匿化した組織名',
      title: uniqueTitle('失敗の位置の先の保存'),
    });
    await page.goto(editUrl);
    await waitForHydration(page.locator('main form').first());

    const other = await context.newPage();
    await other.goto(editUrl);
    await waitForHydration(other.locator('main form').first());
    await textbox(other, '題').fill(uniqueTitle('先に保存した題'));
    await other.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(other.getByRole('status')).toHaveText('保存しました');
    await other.close();

    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(page.getByRole('alert')).toBeFocused();
  });
});
