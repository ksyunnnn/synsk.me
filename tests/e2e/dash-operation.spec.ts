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
import { routes } from '../../src/shared/routes';

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
    // 実績は、選んだ 1 件の中で、保存のボタンが `form` 属性で指すフォームが内容の区切り。ボタンは
    // ペインの上の行にあり、フォームの外に置かれる（src/shared/components/detail-sheet.tsx）
    const detail = page.getByRole('region', { name: '選んだ実績' });
    const save = detail.getByRole('button', { name: '保存する', exact: true });
    await expect(save).toBeVisible();
    const formId = await save.getAttribute('form');
    expect(formId, '保存のボタンがフォームを指していない').toBeTruthy();
    const content = detail.locator(`form[id="${formId}"]`);
    await expect(content).toHaveCount(1);
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

    // 保存していない入力があるので、再読み込みの前の確かめを受け入れる
    page.once('dialog', (dialog) => dialog.accept());
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
      // 職務経歴書には、上の帯と結びの 2 か所に「トップへ戻る」がある。どのページにもある
      // 上の帯の戻る道を確かめるため、文書の順で最初のリンクを押す
      await visitor.getByRole('link', { name: 'トップへ戻る', exact: true }).first().click();
      await expect(visitor).toHaveURL(routes.top);
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
      await expect(visitor).toHaveURL(routes.top);
    }
    await visitor.close();
  });

  test('オーナーでない人が管理画面を開くと、トップへ戻るリンクが出る', async ({ browser }) => {
    const visitor = await openVisitor(browser);
    expect(await visit(visitor, '/dash')).toBe(403);
    await visitor.getByRole('link', { name: 'トップへ戻る', exact: true }).click();
    await expect(visitor).toHaveURL(routes.top);
    await visitor.close();
  });
});

test.describe('狭い画面のシート', () => {
  /** inert の祖先を持つか。inert の中は読み上げの木から外れるため、role では探さない */
  const inertCount = (page: Page, selector: string) =>
    page.locator(selector).first().locator('xpath=ancestor-or-self::*[@inert]');
  const NAV = 'nav[aria-label="管理する項目"]';
  const ROW = 'main table a[aria-current="true"]';

  test('行を選ぶと半分の高さで開いて見出しへフォーカスが移り、つまみで高さを切り替え、閉じると選んだ行へ戻る', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const title = uniqueTitle('シート');
    await registerProject(page, {
      organizationName: 'E2E シートの組織',
      organizationNameMasked: 'E2E シートの秘匿化した組織名',
      title,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(routes.dash.projects.list);
    const row = page.getByRole('link', { name: title, exact: true });
    await waitForHydration(row);
    await row.click();
    const sheet = page.getByRole('dialog', { name: '選んだ実績' });
    await expect(sheet.getByRole('heading', { level: 2, name: title })).toBeFocused();
    // 一覧で行を選んだときは半分の高さで開く。モーダルにしないため、後ろも操作できる
    await expect(sheet.getByRole('button', { name: '全体の高さにする' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(inertCount(page, ROW)).toHaveCount(0);
    await sheet.getByRole('button', { name: '全体の高さにする' }).click();
    await expect(sheet.getByRole('button', { name: '半分の高さにする' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // 全体の高さの間は、覆われた一覧と Sidebar がフォーカスを受けない
    await expect(inertCount(page, ROW)).toHaveCount(1);
    await expect(inertCount(page, NAV)).toHaveCount(1);
    await sheet.getByRole('button', { name: '閉じる' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/selected=/);
    await expect(row).toBeFocused();
  });

  test('選んだ 1 件の URL を直接開くと、全体の高さの CSS のシートで開いて一覧を覆い、閉じると選んだ行へ戻る', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const title = uniqueTitle('シートを直接開く');
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E シートの組織',
      organizationNameMasked: 'E2E シートの秘匿化した組織名',
      title,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(editUrl);
    const sheet = page.getByRole('region', { name: '選んだ実績' });
    await expect(sheet.getByRole('heading', { level: 2, name: title })).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // 覆われた一覧の行と Sidebar は、フォーカスを受けない
    const row = page.getByRole('link', { name: title, exact: true });
    await expect(inertCount(page, ROW)).toHaveCount(1);
    await expect(inertCount(page, NAV)).toHaveCount(1);
    await sheet.getByRole('link', { name: '閉じる' }).click();
    await expect(page).not.toHaveURL(/selected=/);
    await expect(row).toBeFocused();
    // 閉じた後に行を選ぶと、Drawer で半分の高さから開く
    await row.click();
    await expect(
      page.getByRole('dialog', { name: '選んだ実績' }).getByRole('button', {
        name: '全体の高さにする',
      }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  test('選んだ 1 件の URL を直接開いて、動く前に打った入力は、動いた後も残る', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E シートの組織',
      organizationNameMasked: 'E2E シートの秘匿化した組織名',
      title: uniqueTitle('動く前の入力'),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const typed = 'E2E 動く前に打った題';
    await typeBeforeHydration(page, editUrl, typed, '題');
    // 狭い画面に合わせて描き直した後も残る
    const sheet = page.getByRole('region', { name: '選んだ実績' });
    await expect(sheet.getByRole('heading', { level: 2 }).first()).toBeFocused();
    await expect(textbox(page, '題')).toHaveValue(typed);
  });
});

test.describe('詳細を隠した Split view', () => {
  test('詳細を隠して 1 件を選ぶと、一覧の幅を保ったまま詳細がドロワーで重なり、Esc で閉じる', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const title = uniqueTitle('ドロワー');
    await registerProject(page, {
      organizationName: 'E2E ドロワーの組織',
      organizationNameMasked: 'E2E ドロワーの秘匿化した組織名',
      title,
    });
    await page.goto('/dash/projects');
    const hide = page.getByRole('button', { name: '詳細を隠す' });
    await waitForHydration(hide);
    await hide.click();
    const toolbar = page.getByRole('heading', { name: '実績', level: 1 }).locator('..');
    const before = await toolbar.boundingBox();

    await page.getByRole('link', { name: title }).click();
    const drawer = page.getByRole('region', { name: '選んだ実績' });
    await expect(drawer.getByRole('heading', { name: title })).toBeVisible();
    // 一覧の列は狭まらない（src/shared/components/detail-sheet.tsx の peek）
    expect((await toolbar.boundingBox())?.width).toBe(before?.width);

    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/selected=/);
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: '詳細を隠す' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /** ドロワーが右へ出ていく時間（detail-sheet.tsx の PEEK_MS）より長く待つ */
  const pastLeaving = (page: Page) => page.waitForTimeout(600);
  /** 選んだ 1 件の URL に合う形 */
  const selecting = (editUrl: string) =>
    new RegExp(`[?&]selected=${new URL(editUrl).searchParams.get('selected')}(&|$)`);

  test('閉じる動きの間に戻る・別の行を選ぶと、閉じずに移った先を出し、進む履歴も残る', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const organization = {
      organizationName: 'E2E ドロワーの組織',
      organizationNameMasked: 'E2E ドロワーの秘匿化した組織名',
    };
    const first = uniqueTitle('閉じる間の 1 件め');
    const second = uniqueTitle('閉じる間の 2 件め');
    const firstUrl = selecting(
      (await registerProject(page, { ...organization, title: first })).editUrl,
    );
    const secondUrl = selecting(
      (await registerProject(page, { ...organization, title: second })).editUrl,
    );
    await page.goto('/dash/projects');
    const hide = page.getByRole('button', { name: '詳細を隠す' });
    await waitForHydration(hide);
    await hide.click();
    const drawer = page.getByRole('region', { name: '選んだ実績' });
    await page.getByRole('link', { name: first }).click();
    await expect(drawer.getByRole('heading', { name: first })).toBeVisible();
    await page.getByRole('link', { name: second }).click();
    await expect(drawer.getByRole('heading', { name: second })).toBeVisible();

    // 閉じるを押してすぐ戻る。同じ処理の中で続けて行い、閉じる動きの間に戻ったことを確かにする
    await drawer.evaluate((element) => {
      element.querySelector<HTMLElement>('a[aria-label="閉じる"]')?.click();
      history.back();
    });
    await expect(page).toHaveURL(firstUrl);
    await pastLeaving(page);
    await expect(page).toHaveURL(firstUrl);
    await expect(drawer.getByRole('heading', { name: first })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(secondUrl);

    // 閉じるを押してすぐ別の行を選ぶ
    await page.evaluate((title) => {
      const links = [...document.querySelectorAll<HTMLElement>('main a')];
      links.find((link) => link.getAttribute('aria-label') === '閉じる')?.click();
      links.find((link) => link.textContent === title)?.click();
    }, first);
    await expect(page).toHaveURL(firstUrl);
    await pastLeaving(page);
    await expect(page).toHaveURL(firstUrl);
    await expect(drawer.getByRole('heading', { name: first })).toBeVisible();
  });

  test('ドロワーを全体に広げてから戻ると、詳細を隠したまま選ぶ前に戻り、進むとドロワーで出る', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const title = uniqueTitle('全体に広げる');
    const { editUrl } = await registerProject(page, {
      organizationName: 'E2E ドロワーの組織',
      organizationNameMasked: 'E2E ドロワーの秘匿化した組織名',
      title,
    });
    await page.goto('/dash/projects');
    const hide = page.getByRole('button', { name: '詳細を隠す' });
    await waitForHydration(hide);
    await hide.click();
    await page.getByRole('link', { name: title }).click();
    const drawer = page.getByRole('region', { name: '選んだ実績' });
    await drawer.getByRole('button', { name: '全体に広げる' }).click();
    // 広げると一覧の列を隠す。広げたことは履歴に載せない
    await expect(page.getByRole('link', { name: title })).toBeHidden();
    await expect(page).toHaveURL(selecting(editUrl));

    await page.goBack();
    await expect(page).not.toHaveURL(/selected=/);
    await expect(page.getByRole('link', { name: title })).toBeVisible();
    await expect(hide).toHaveAttribute('aria-pressed', 'true');

    await page.goForward();
    await expect(page).toHaveURL(selecting(editUrl));
    await expect(drawer.getByRole('button', { name: '全体に広げる' })).toBeVisible();
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  });
});
