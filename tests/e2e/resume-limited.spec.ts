import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createLimitedResume,
  openVisitor,
  registerCareer,
  registerProject,
  setResumeExpires,
  setResumeVisible,
  submitLimitedResume,
  visit,
} from './support/dash';

/**
 * 限定公開用の職務経歴書を訪問者に渡すまで（specs/002-resume/spec.md の User Story 1 の 5、
 * User Story 2 の 1〜5、FR-010〜FR-014・FR-021〜FR-023・FR-040、SC-003・SC-004）。
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

/** URL の識別子の最後の 1 文字を変える */
const withWrongSlug = (path: string) => path.slice(0, -1) + (path.endsWith('a') ? 'b' : 'a');

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('URL は /resume/{uid} で、作成の画面と設定の画面に同じ URL を示し、公開中ならその URL で開ける（FR-012・FR-040）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSourceCareer(page, 'URL の表示');
  const { url, settingsUrl } = await createLimitedResume(page, {
    title: 'E2E URL の表示の職務経歴書',
    keep: keepOf('URL の表示'),
  });
  const path = new URL(url).pathname;
  expect(path.split('/')).toHaveLength(3);
  expect(path.split('/')[2]).toMatch(UID);

  // 作成の画面から移ると、前の画面が隠れて DOM に残る。設定の画面を読み直してから調べる
  await page.goto(settingsUrl);
  await expect(page.getByRole('textbox', { name: '限定公開用の URL' })).toHaveValue(url);
  await setResumeVisible(page, true);
  await expect(page.getByRole('textbox', { name: '限定公開用の URL' })).toHaveValue(url);

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);
  await expect(
    visitor.getByRole('heading', { name: 'E2E 限定公開の組織 URL の表示' }),
  ).toBeVisible();
  await visitor.close();
});

test('URL を出し直すと識別子が新しい uid になり、古い URL は 404、新しい URL は 200 になる（FR-040）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSourceCareer(page, '出し直し');
  const { url, settingsUrl } = await createLimitedResume(page, {
    title: 'E2E 出し直しの職務経歴書',
    keep: keepOf('出し直し'),
  });
  await page.goto(settingsUrl);
  await setResumeVisible(page, true);
  const oldPath = new URL(url).pathname;
  const visitor = await openVisitor(browser);
  expect(await visit(visitor, oldPath)).toBe(200);

  await page.getByRole('button', { name: 'URL を出し直す' }).click();
  await expect(page.getByRole('status')).toHaveText('URL を出し直しました');
  const fresh = await page.getByRole('textbox', { name: '限定公開用の URL' }).inputValue();
  const freshPath = new URL(fresh).pathname;
  expect(freshPath).not.toBe(oldPath);
  expect(freshPath.split('/')[2]).toMatch(UID);
  // 状態は出し直しで変わらない
  await expect(page.getByText('公開中', { exact: true })).toBeVisible();

  expect(await visit(visitor, oldPath)).toBe(404);
  expect(await visitor.content()).not.toContain('E2E 限定公開の組織 出し直し');
  expect(await visit(visitor, freshPath)).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E 限定公開の組織 出し直し' })).toBeVisible();
  await visitor.close();
});

test('下書きの間と、存在しない識別子の URL では 404 で中身を出さず、訪問者に見せる状態の正しい URL でだけ読める', async ({
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

  const visitor = await openVisitor(browser);
  const expectNoContent = async (target: string) => {
    expect(await visit(visitor, target), target).toBe(404);
    expect(await visitor.content(), target).not.toContain('E2E 限定公開の組織 状態');
  };

  await expectNoContent(path);

  await setResumeVisible(page, true);
  expect(await visit(visitor, path)).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E 限定公開の組織 状態' })).toBeVisible();
  await expectNoContent(withWrongSlug(path));

  await setResumeVisible(page, false);
  await expectNoContent(path);
  await visitor.close();
});

test('作成の画面で公開すると、URL を示したまま、その URL が 200 で開き、知らせが「公開中です」に変わる。非公開の間は URL に「公開すると開けます」と添える', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSourceCareer(page, '作成の画面');
  const url = await submitLimitedResume(page, {
    title: 'E2E 作成の画面の職務経歴書',
    keep: keepOf('作成の画面'),
  });
  const path = new URL(url).pathname;
  const note = page.getByText('公開すると開けます', { exact: true });
  await expect(note).toBeVisible();
  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(404);

  const notice = page.getByRole('status');
  await setResumeVisible(page, true);
  await expect(notice).toHaveText('限定公開用の職務経歴書を作りました。公開中です');
  await expect(page.getByRole('textbox', { name: '限定公開用の URL' })).toHaveValue(url);
  await expect(note).toHaveCount(0);
  expect(await visit(visitor, path)).toBe(200);
  await expect(
    visitor.getByRole('heading', { name: 'E2E 限定公開の組織 作成の画面' }),
  ).toBeVisible();

  // 切り替えた後の更新日時で、続けて非公開にできる
  await setResumeVisible(page, false);
  await expect(notice).toHaveText('限定公開用の職務経歴書を作りました。非公開です');
  await expect(page.getByRole('textbox', { name: '限定公開用の URL' })).toHaveValue(url);
  await expect(note).toBeVisible();
  expect(await visit(visitor, path)).toBe(404);
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
  // 期限が切れても職務経歴書は消えず、オーナーは読める（Edge Cases）
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
