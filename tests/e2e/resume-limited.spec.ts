import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createLimitedResume,
  openVisitor,
  registerCareer,
  registerProject,
  setResumeExpires,
  setResumeVisible,
  visit,
} from './support/dash';

/**
 * 限定公開用の職務経歴書を訪問者に渡すまで（specs/002-resume/spec.md の User Story 1 の 5、
 * User Story 2 の 1〜5、FR-010・FR-011・FR-013・FR-014・FR-021〜FR-023、SC-003・SC-004）。
 * 管理画面で作る・切り替える・期限を変えた結果が、訪問者の URL に届くまでを通しで確かめる。
 * 応答のヘッダ（User Story 2 の 6）と D1 の行は結合の検査が持つ。
 *
 * 公開用（User Story 5）は作成の画面に選択肢が無い（specs/002-resume/tasks.md の Phase 7）。
 * ここでは、限定公開用の中身が公開用の経路 `/resume` に出ないことだけを確かめる。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** 写し元の職歴を登録する。組織名・肩書はどちらも `tag` を含む */
const registerSourceCareer = (page: Page, tag: string) =>
  registerCareer(page, {
    organizationName: `E2E 限定公開の組織 ${tag}`,
    organizationNameMasked: `E2E 限定公開の秘匿化した組織 ${tag}`,
    role: `E2E 限定公開の肩書 ${tag}`,
  });

/** `tag` を名前に含む写し元だけを選ぶ */
const keepOf = (tag: string) => new RegExp(`E2E 限定公開の\\S+ ${tag}`);

/** URL の鍵の最後の 1 文字を変える */
const withWrongKey = (url: string) => url.slice(0, -1) + (url.endsWith('A') ? 'B' : 'A');

test('鍵を含む URL は作った画面にだけ示し、設定の画面と一覧には出さない', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await registerSourceCareer(page, '鍵の表示');
  const { url, settingsUrl } = await createLimitedResume(page, {
    title: 'E2E 鍵の表示の職務経歴書',
    keep: keepOf('鍵の表示'),
  });
  const key = url.split('/').at(-1) as string;
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);

  await expect(
    page.getByText('限定公開用の URL は作ったときの画面でだけ示します', { exact: false }),
  ).toBeVisible();
  // 作成の画面から移ると、前の画面が隠れて DOM に残る。設定の画面を読み直してから調べる
  await page.goto(settingsUrl);
  expect(await page.content()).not.toContain(key);
  await page.goto('/dash/resumes');
  expect(await page.content()).not.toContain(key);
  await page.goto('/dash/resumes/new');
  await expect(page.getByRole('textbox', { name: '限定公開用の URL' })).toHaveCount(0);
});

test('下書きの間と、鍵が違う・鍵が無い URL では 404 で中身を出さず、訪問者に見せる状態の正しい URL でだけ読める', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSourceCareer(page, '状態');
  const { url } = await createLimitedResume(page, {
    title: 'E2E 状態の職務経歴書',
    keep: keepOf('状態'),
  });
  await expect(page.getByText('限定公開用・期限 期限なし')).toBeVisible();
  const path = new URL(url).pathname;
  const slugPath = path.split('/').slice(0, 3).join('/');

  const visitor = await openVisitor(browser);
  const expectNoContent = async (target: string) => {
    expect(await visit(visitor, target), target).toBe(404);
    expect(await visitor.content(), target).not.toContain('E2E 限定公開の組織 状態');
  };

  await expectNoContent(path);

  await setResumeVisible(page, true);
  expect(await visit(visitor, path)).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E 限定公開の組織 状態' })).toBeVisible();
  await expectNoContent(withWrongKey(path));
  await expectNoContent(slugPath);

  await setResumeVisible(page, false);
  await expectNoContent(path);
  await visitor.close();
});

test('期限を過ぎると 404 になり、設定の画面に過ぎていると出る。期限を先に延ばすと同じ URL で読める', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSourceCareer(page, '期限');
  const { url } = await createLimitedResume(page, {
    title: 'E2E 期限の職務経歴書',
    keep: keepOf('期限'),
    expires: '2099-12-31T23:59',
  });
  await expect(page.getByText('限定公開用・期限 2099-12-31 23:59（日本時間）')).toBeVisible();
  await setResumeVisible(page, true);
  const path = new URL(url).pathname;
  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);

  await setResumeExpires(page, '2020-01-01T00:00');
  await expect(
    page.getByText('過ぎています。訪問者には中身を返しません', { exact: false }),
  ).toBeVisible();
  expect(await visit(visitor, path)).toBe(404);
  expect(await visitor.content()).not.toContain('E2E 限定公開の組織 期限');
  // 期限が切れても職務経歴書は消えず、作り手は読める（Edge Cases）
  await page.getByRole('link', { name: '訪問者に見せたときの見た目を見る' }).click();
  await expect(page.getByRole('heading', { name: 'E2E 限定公開の組織 期限' })).toBeVisible();
  await page.getByRole('link', { name: '設定の画面へ戻る' }).click();

  await setResumeExpires(page, '2099-12-31T23:59');
  expect(await visit(visitor, path)).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E 限定公開の組織 期限' })).toBeVisible();

  await setResumeExpires(page, '');
  await expect(page.getByText('限定公開用・期限 期限なし')).toBeVisible();
  expect(await visit(visitor, path)).toBe(200);
  await visitor.close();
});

test('秘匿化した・サイトに載せない職歴と実績も、限定公開用には実際の組織名・題・本文・関連 URL で載り、公開用の経路には出ない', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: 'E2E 限定公開の組織 実名',
    organizationNameMasked: 'E2E 限定公開の秘匿化した組織 実名',
    role: 'E2E 限定公開の肩書 実名',
    description: 'E2E 限定公開の職歴の本文 実名',
    url: 'https://example.com/e2e-limited-career',
  });
  await registerProject(page, {
    organizationName: 'E2E 限定公開の組織 実名',
    title: 'E2E 限定公開の題 実名',
    titleMasked: 'E2E 限定公開の秘匿化した題 実名',
    description: 'E2E 限定公開の実績の本文 実名',
    url: 'https://example.com/e2e-limited-project',
  });

  // サイトに載せない行も、作成の画面で選ばれた状態で出る（User Story 1 の 5）
  await page.goto('/dash/resumes/new');
  await expect(
    page.getByRole('checkbox', { name: 'E2E 限定公開の組織 実名・E2E 限定公開の肩書 実名' }),
  ).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'E2E 限定公開の題 実名' })).toBeChecked();

  const { url } = await createLimitedResume(page, {
    title: 'E2E 実名の職務経歴書',
    keep: keepOf('実名'),
  });
  await setResumeVisible(page, true);

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, new URL(url).pathname)).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E 限定公開の組織 実名' })).toBeVisible();
  await expect(visitor.getByText('E2E 限定公開の肩書 実名')).toBeVisible();
  await expect(visitor.getByText('E2E 限定公開の職歴の本文 実名')).toBeVisible();
  await expect(
    visitor.getByRole('link', { name: 'https://example.com/e2e-limited-career' }),
  ).toBeVisible();
  await expect(visitor.getByRole('heading', { name: 'E2E 限定公開の題 実名' })).toBeVisible();
  await expect(visitor.getByText('E2E 限定公開の実績の本文 実名')).toBeVisible();
  await expect(
    visitor.getByRole('link', { name: 'https://example.com/e2e-limited-project' }),
  ).toBeVisible();
  const html = await visitor.content();
  expect(html).not.toContain('E2E 限定公開の秘匿化した題 実名');
  expect(html).not.toContain('E2E 限定公開の秘匿化した組織 実名');
  await expect(visitor).toHaveTitle('職務経歴書 | synsk.me');

  await visitor.goto('/resume');
  const publicHtml = await visitor.content();
  for (const value of ['E2E 限定公開の組織 実名', 'E2E 限定公開の題 実名']) {
    expect(publicHtml, value).not.toContain(value);
  }
  await visitor.close();
});
