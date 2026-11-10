import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createEmptyLimitedResume,
  openVisitor,
  registerEducation,
  registerProject,
  setResumeVisible,
  submitAndWait,
  textbox,
  visit,
} from './support/dash';
import { typeBeforeHydration } from './support/hydration';
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

test.describe('保存の知らせ', () => {
  test('保存すると知らせへフォーカスが移り、次の保存に失敗すると知らせが消え、再読み込みでも出ない', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E 保存の知らせの組織',
      organizationNameMasked: 'E2E 保存の知らせの秘匿化した組織名',
      title: uniqueTitle('保存の知らせ'),
    });
    await page.goto(editUrl);
    await waitForHydration(page.locator('main form').first());
    await textbox(page, '題').fill(uniqueTitle('保存の知らせの書き換えた題'));
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    const notice = page.getByRole('status');
    await expect(notice).toHaveText('保存しました');
    await expect(notice).toBeFocused();
    await expect(page).toHaveURL(editUrl);

    // 続けて保存しても、知らせが出てフォーカスが移る
    await waitForHydration(page.locator('main form').first());
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(page).toHaveURL(editUrl);
    await expect(page.getByRole('status')).toBeFocused();

    await waitForHydration(page.locator('main form').first());
    await textbox(page, '題').fill('');
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
    await expect(page.getByRole('status')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});

test.describe('動く前の入力', () => {
  test('実績の編集の画面で、JavaScript が動く前に本文を打っても、動いた後に残り、保存で送られる', async ({
    page,
    context,
  }) => {
    const typed = `E2E 動く前に打った実績の本文 ${crypto.randomUUID()}`;
    await actAsAuthor(context);
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E 動く前の入力の組織',
      organizationNameMasked: 'E2E 動く前の入力の秘匿化した組織名',
      title: uniqueTitle('動く前の入力'),
      description: 'E2E 初めの本文',
    });
    await typeBeforeHydration(page, editUrl, typed);
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('保存しました');
    await page.goto(editUrl);
    await expect(textbox(page, '本文')).toHaveValue(typed);
  });

  test('学歴の編集の画面で、JavaScript が動く前に備考を打っても、動いた後に残る', async ({
    page,
    context,
  }) => {
    const school = uniqueTitle('動く前の入力の学校');
    await actAsAuthor(context);
    await registerEducation(page, school);
    await page.goto('/dash/educations');
    await page.getByRole('link', { name: school, exact: true }).click();
    await waitForHydration(page.locator('main form').first());
    await textbox(page, '備考').fill('E2E 初めの備考');
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('保存しました');
    await page.getByRole('link', { name: school, exact: true }).click();
    await expect(textbox(page, '備考')).toHaveValue('E2E 初めの備考');
    const editUrl = page.url();

    await typeBeforeHydration(page, editUrl, 'E2E 動く前に打った備考', '備考');
  });
});

test.describe('戻る道', () => {
  test('訪問者の個別のページから、トップへ戻れる', async ({ page, context, browser }) => {
    await actAsAuthor(context);
    const { path: projectPath } = await registerProject(page, {
      organizationName: 'E2E 戻る道の組織',
      organizationNameMasked: 'E2E 戻る道の秘匿化した組織名',
      title: uniqueTitle('戻る道の実績'),
      onSite: true,
      isMasked: false,
    });
    const noteSlug = uniqueNoteSlug('back-to-top');
    await createNote(page, { slug: noteSlug, title: 'E2E 戻る道の note' });
    await submitAndWait(page, '最も新しい版を公開する');
    const lifeEventSlug = `e2e-back-to-top-${crypto.randomUUID().slice(0, 8)}`;
    await page.goto('/dash/life-events/new');
    await textbox(page, '題').fill('E2E 戻る道の出来事');
    await textbox(page, '起きた日').fill('2020-04-01');
    await textbox(page, '識別子').fill(lifeEventSlug);
    await page.getByRole('button', { name: '作る' }).click();
    await expect(page.getByRole('status')).toHaveText('保存しました');
    await createEmptyLimitedResume(page, uniqueTitle('戻る道の職務経歴書'));
    const resumeUrl = await textbox(page, '限定公開用の URL').inputValue();
    await setResumeVisible(page, true);

    const visitor = await openVisitor(browser);
    for (const path of [
      projectPath,
      `/notes/${noteSlug}`,
      `/life-events/${lifeEventSlug}`,
      new URL(resumeUrl).pathname,
    ]) {
      await visitor.goto(path);
      await visitor.getByRole('link', { name: 'トップへ戻る', exact: true }).click();
      await expect(visitor).toHaveURL('/top-draft');
    }
    await visitor.close();
  });
});

test.describe('404 の画面', () => {
  test('無いページを開くと、日本語の説明とトップへ戻るリンクが出る', async ({ browser }) => {
    const visitor = await openVisitor(browser);
    for (const path of [
      `/projects/e2e-no-such-${crypto.randomUUID().slice(0, 8)}`,
      `/notes/e2e-no-such-${crypto.randomUUID().slice(0, 8)}`,
    ]) {
      expect(await visit(visitor, path)).toBe(404);
      await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('ページが見つかりません');
      await visitor.getByRole('link', { name: 'トップへ戻る', exact: true }).click();
      await expect(visitor).toHaveURL('/top-draft');
    }
    await visitor.close();
  });

  test('オーナーでない人が管理画面を開くと、トップへ戻るリンクが出る', async ({ browser }) => {
    const visitor = await openVisitor(browser);
    expect(await visit(visitor, '/dash')).toBe(403);
    await visitor.getByRole('link', { name: 'トップへ戻る', exact: true }).click();
    await expect(visitor).toHaveURL('/top-draft');
    await visitor.close();
  });
});
