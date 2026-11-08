import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createLimitedResume,
  registerCareer,
  registerEducation,
  setResumeVisible,
} from './support/dash';

/**
 * オーナーとしての職務経歴書の作成・編集・状態の切り替え・削除と、同じ職務経歴書を 2 つのタブで
 * 開いたときに後から保存した側が止まり入力が残ること（specs/002-resume/spec.md の FR-003・
 * FR-005・FR-031・FR-038・SC-006、REQUIREMENTS.md の FR-11・FR-13、constitution V）。
 * HTTP の状態コードと D1 の行は結合の検査が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。入力は
 * `getByRole` で探す（tests/e2e/career-and-education.spec.ts と同じ理由）
 */

/** 写し元の職歴と学歴を、001 の管理画面で登録する。名前はどれも `tag` を含む */
const registerSources = async (page: Page, tag: string) => {
  await registerCareer(page, {
    organizationName: `E2E 職務経歴書の組織 ${tag}`,
    organizationNameMasked: 'E2E の会社',
    role: `E2E 職務経歴書の肩書 ${tag}`,
  });
  await registerEducation(page, `E2E 職務経歴書の学校 ${tag}`);
};

/** `tag` を名前に含む職歴・学歴だけを選んで作る（tests/e2e/support/dash.ts の keepOnlySources） */
const createResume = (page: Page, title: string, tag: string) =>
  createLimitedResume(page, { title, keep: new RegExp(`E2E 職務経歴書の\\S+ ${tag}`) });

test('作成の画面は、すべての職歴・実績・学歴を選んだ状態で始まり、外した行は載らない（キーボードだけで操作する）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await registerSources(page, '作成');

  await page.goto('/dash/resumes/new');
  const checkboxes = page.getByRole('checkbox');
  const count = await checkboxes.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i += 1) await expect(checkboxes.nth(i)).toBeChecked();
  // 限定公開用か公開用かは、限定公開用を選んだ状態で始まる（FR-003）
  await expect(page.getByRole('radio', { name: /^限定公開用/ })).toBeChecked();

  // キーボードだけで、題を入れ、学歴を 1 件外し、作る。ほかのテストの行も外す。ほかのテストが
  // 並行して消す行を選んだまま送ると、作成が止まる（tests/e2e/support/dash.ts）
  await page.getByRole('textbox', { name: '題' }).focus();
  await page.keyboard.type('E2E の外す検査');
  const others = page.getByRole('checkbox', {
    checked: true,
    name: /^(?!.*E2E 職務経歴書の\S+ 作成)/,
  });
  while ((await others.count()) > 0) {
    await others.first().focus();
    await page.keyboard.press('Space');
  }
  const school = page.getByRole('checkbox', { name: 'E2E 職務経歴書の学校 作成' });
  await school.focus();
  await page.keyboard.press('Space');
  await expect(school).not.toBeChecked();
  await page.getByRole('button', { name: '作る' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status')).toHaveText(
    '限定公開用の職務経歴書を作りました。非公開です',
  );
  await expect(page.getByRole('textbox', { name: '限定公開用の URL' })).toHaveValue(
    /\/resume\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await page.getByRole('link', { name: '設定の画面へ' }).click();
  await expect(page.getByRole('link', { name: /E2E 職務経歴書の肩書 作成/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'E2E 職務経歴書の学校 作成' })).toHaveCount(0);
});

test('写した行を直し、状態を切り替え、訪問者のページで読み、削除できる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSources(page, '編集');
  const { url } = await createResume(page, 'E2E の編集の検査', '編集');

  // 写した職歴を直す（FR-031）
  await page.getByRole('link', { name: /E2E 職務経歴書の肩書 編集/ }).click();
  await page.getByRole('textbox', { name: '組織名' }).fill('E2E で直した組織名');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('link', { name: /E2E で直した組織名/ })).toBeVisible();

  // 下書きでも、見た目の確認の画面は出る（REQUIREMENTS.md の FR-13）
  await page.getByRole('link', { name: '訪問者に見せたときの見た目を見る' }).click();
  await expect(page.getByRole('heading', { name: 'E2E で直した組織名' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF で保存' })).toBeVisible();
  await page.getByRole('link', { name: '設定の画面へ戻る' }).click();

  // 訪問者は、下書きのうちは読めない。見せる状態にすると読める
  const visitor = await browser.newPage();
  expect((await visitor.goto(url))?.status()).toBe(404);
  await setResumeVisible(page, true);
  expect((await visitor.goto(url))?.status()).toBe(200);
  await expect(visitor.getByRole('heading', { name: 'E2E で直した組織名' })).toBeVisible();
  await visitor.close();

  // 削除（REQUIREMENTS.md の FR-11）
  await page.getByRole('link', { name: 'この職務経歴書を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('職務経歴書を削除しました');
  await expect(page.getByRole('link', { name: 'E2E の編集の検査' })).toHaveCount(0);
});

test('同じ職務経歴書を 2 つのタブで開くと、後から保存した側は止まり、入力が残る（FR-038）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await registerSources(page, '同時');
  await createResume(page, 'E2E の同時編集', '同時');
  const settingsUrl = page.url().replace(/\?.*$/, '');

  const other = await context.newPage();
  await other.goto(settingsUrl);

  await page.getByRole('textbox', { name: '題' }).fill('先に保存した題');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await other.getByRole('textbox', { name: '題' }).fill('後から保存した題');
  await other.getByRole('button', { name: '保存する' }).click();
  await expect(other.getByRole('alert')).toContainText('別の画面で書き換えられていました');
  await expect(other.getByRole('textbox', { name: '題' })).toHaveValue('後から保存した題');

  await other.goto(settingsUrl);
  await expect(other.getByRole('textbox', { name: '題' })).toHaveValue('先に保存した題');
});
