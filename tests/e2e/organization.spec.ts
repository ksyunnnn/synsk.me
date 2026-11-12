import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { openVisitor, registerCareer, registerProject, saveEdit } from './support/dash';

/**
 * 組織の画面（specs/001-career-and-project/spec.md の User Story 3 の 2・3、FR-001・FR-003・
 * FR-004・FR-006）。組織は職歴・実績の入力の中で作られ、組織の画面では直す・消すだけを行う。
 * 組織名の入力に過去の組織名を選択肢として出すこと（User Story 3 の 1、FR-002）は、部品が
 * 決まっていない（specs/001-career-and-project/plan.md の U3）。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** 組織の一覧から、組織名で編集の画面を開く */
const openOrganization = async (page: Page, name: string) => {
  await page.goto('/dash/organizations');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('組織を編集する');
};

test('組織名を直すと、その組織を指す職歴と実績の表示が変わり、組織は 1 つのまま', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: 'E2E 直す前の組織',
    organizationNameMasked: 'E2E 直す組織の秘匿化した組織名',
    role: 'E2E 直す組織の肩書',
  });
  const { path } = await registerProject(page, {
    organizationName: 'E2E 直す前の組織',
    title: 'E2E 直す組織の実績',
    isMasked: false,
    onSite: true,
  });

  await page.goto('/dash/organizations');
  await expect(page.getByRole('link', { name: 'E2E 直す前の組織', exact: true })).toHaveCount(1);
  await openOrganization(page, 'E2E 直す前の組織');
  // 職歴と実績が指している組織は消せない（FR-006）
  await expect(page.getByRole('link', { name: 'この組織を削除する' })).toHaveCount(0);
  await page.getByRole('textbox', { name: '組織名', exact: true }).fill('E2E 直した後の組織');
  await saveEdit(page);

  await page.goto('/dash/careers');
  await expect(page.getByRole('link', { name: /E2E 直した後の組織/ })).toBeVisible();
  await page.goto('/dash/projects');
  // 組織で絞り込む select の選択肢にも組織名が出るため、カードの中で探す
  await expect(page.getByRole('listitem').getByText(/E2E 直した後の組織/)).toBeVisible();

  const visitor = await openVisitor(browser);
  await visitor.goto(path);
  await expect(visitor.getByText('E2E 直した後の組織')).toBeVisible();
  expect(await visitor.content()).not.toContain('E2E 直す前の組織');
  await visitor.close();
});

test('ほかの組織と同じ組織名には直せず、入力が残る', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 重なる組織名 1',
    title: 'E2E 重なる組織名の実績 1',
    isMasked: false,
  });
  await registerProject(page, {
    organizationName: 'E2E 重なる組織名 2',
    title: 'E2E 重なる組織名の実績 2',
    isMasked: false,
  });

  await openOrganization(page, 'E2E 重なる組織名 2');
  await page.getByRole('textbox', { name: '組織名', exact: true }).fill('E2E 重なる組織名 1');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(page.getByText('この組織名の組織はほかにあります')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '組織名', exact: true })).toHaveValue(
    'E2E 重なる組織名 1',
  );
});

test('秘匿化した実績が指す組織は、秘匿化した組織名を空にできない', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 秘匿化した実績の組織',
    organizationNameMasked: 'E2E 秘匿化した実績の組織の秘匿化した組織名',
    title: 'E2E 秘匿化した実績の組織の実績',
    titleMasked: 'E2E 秘匿化した実績の組織の秘匿化した題',
  });

  await openOrganization(page, 'E2E 秘匿化した実績の組織');
  await page.getByRole('textbox', { name: '秘匿化した組織名' }).fill('');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(
    page.getByText(
      '秘匿化した職歴・実績がこの組織を指しているため、秘匿化した組織名を空にできません',
    ),
  ).toBeVisible();
});

test('どの職歴・実績にも指されなくなった組織は、削除できる', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 消す組織',
    title: 'E2E 消す組織の実績',
    isMasked: false,
  });
  await page.getByRole('link', { name: 'この実績を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('実績を削除しました');

  await openOrganization(page, 'E2E 消す組織');
  await page.getByRole('link', { name: 'この組織を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('組織を削除しました');
  await expect(page.getByRole('link', { name: 'E2E 消す組織', exact: true })).toHaveCount(0);
});
