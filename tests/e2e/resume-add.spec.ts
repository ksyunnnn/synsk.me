import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  addResumeRow,
  createEmptyLimitedResume,
  registerCareer,
  registerEducation,
  registerProject,
  openResumeTab,
  saveEdit,
} from './support/dash';

/**
 * 作ったあとに、元の職歴・実績・学歴を職務経歴書に足す（specs/002-resume/spec.md の FR-041、
 * User Story 6）。足した行は足したときの元の値で写し、元を直しても変わらない。HTTP の状態コードと
 * D1 の行は結合の検査が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。入力は
 * `getByRole` で探す（tests/e2e/support/dash.ts）
 */

test('0 件の職務経歴書に、写した行のタブから職歴・実績・学歴を足すと、写した行と直すリンクが出る。足したあとに元を直しても変わらない', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const careerEditUrl = await registerCareer(page, {
    organizationName: 'E2E 足す検査の組織',
    organizationNameMasked: 'E2E の会社',
    role: 'E2E 足す検査の肩書',
  });
  const { editUrl: projectEditUrl } = await registerProject(page, {
    organizationName: 'E2E 足す検査の組織',
    title: 'E2E 足す検査の実績',
  });
  await registerEducation(page, 'E2E 足す検査の学校');

  const settingsUrl = await createEmptyLimitedResume(page, 'E2E の足す検査');
  for (const kind of ['実績', '職歴', '学歴'] as const) {
    await openResumeTab(page, `写した${kind}`);
    await expect(page.getByText(`写した${kind}はありません`, { exact: true })).toBeVisible();
  }

  await addResumeRow(page, '職歴', 'E2E 足す検査の組織・E2E 足す検査の肩書');
  await addResumeRow(page, '実績', 'E2E 足す検査の実績');
  await addResumeRow(page, '学歴', 'E2E 足す検査の学校');

  // 写した行と、その行を選んで直すリンクが、種類ごとのタブに出る。職歴の 1 列めは組織名
  const rows = [
    { kind: 'careers', tab: '写した職歴', name: 'E2E 足す検査の組織', text: 'E2E 足す検査の肩書' },
    { kind: 'projects', tab: '写した実績', name: 'E2E 足す検査の実績', text: 'E2E 足す検査の実績' },
    {
      kind: 'educations',
      tab: '写した学歴',
      name: 'E2E 足す検査の学校',
      text: 'E2E 足す検査の学校',
    },
  ] as const;
  for (const { kind, tab, name, text } of rows) {
    await openResumeTab(page, tab);
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute(
      'href',
      new RegExp(`^/dash/resumes/[0-9a-f]{32}/${kind}\\?selected=[0-9a-f]{32}$`),
    );
    await expect(page.getByRole('row').filter({ has: link })).toContainText(text);
  }

  // 写した職歴は、足す画面の選択肢に出ない
  await openResumeTab(page, '写した職歴');
  await page.getByRole('link', { name: '経歴から写す' }).click();
  await expect(page.getByRole('heading', { name: '職歴を足す' })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'E2E 足す検査の組織・E2E 足す検査の肩書' }),
  ).toHaveCount(0);

  // 元の職歴の肩書と実績の題を直しても、職務経歴書の値は変わらない（FR-007）
  await page.goto(careerEditUrl);
  await page.getByRole('textbox', { name: '肩書', exact: true }).fill('E2E 足した後に直した肩書');
  await saveEdit(page);
  await page.goto(projectEditUrl);
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 足した後に直した題');
  await saveEdit(page);

  await page.goto(settingsUrl);
  for (const { tab, name, text } of rows) {
    await openResumeTab(page, tab);
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name, exact: true }) });
    await expect(row).toContainText(text);
    await expect(row).not.toContainText('E2E 足した後に直した');
  }
});
