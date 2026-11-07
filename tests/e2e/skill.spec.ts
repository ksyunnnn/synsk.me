import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { registerProject, registerSkill } from './support/dash';

/**
 * スキルの画面（specs/001-career-and-project/spec.md の User Story 4 の 1〜3、FR-031〜FR-034）。
 * 経験年数の求め方の組み合わせは単体の検査（tests/unit/period-experience.test.ts）が持つ。
 * ここでは、実績の画面でつないだスキルの経験年数が、スキルの画面に届くまでを確かめる。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** スキルの一覧の、名前の行 */
const skillRow = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });

/** スキルの一覧から、名前で編集の画面を開く */
const openSkill = async (page: Page, name: string) => {
  await page.goto('/dash/skills');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('スキルを編集する');
};

test('スキルを登録・編集・削除できる', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerSkill(page, 'E2E-Skill-Crud');
  await expect(skillRow(page, 'E2E-Skill-Crud')).toBeVisible();

  await openSkill(page, 'E2E-Skill-Crud');
  await page.getByRole('textbox', { name: '名前' }).fill('E2E-Skill-Crud-Renamed');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(skillRow(page, 'E2E-Skill-Crud-Renamed')).toBeVisible();

  await openSkill(page, 'E2E-Skill-Crud-Renamed');
  await page.getByRole('link', { name: 'このスキルを削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('スキルを削除しました');
  await expect(page.getByRole('link', { name: 'E2E-Skill-Crud-Renamed', exact: true })).toHaveCount(
    0,
  );
});

test('大文字と小文字だけが違う名前のスキルは登録できず、入力が残る', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerSkill(page, 'E2E-Skill-Case');

  await page.goto('/dash/skills/new');
  await page.getByRole('textbox', { name: '名前' }).fill('e2e-skill-case');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(
    page.getByText('大文字と小文字だけが違う名前のスキルが、ほかにあります'),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: '名前' })).toHaveValue('e2e-skill-case');
});

test('経験年数は、つないだ実績の期間を重なりを除いてつないだ長さで出て、上書きするとその値が出る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await registerSkill(page, 'E2E-Skill-Years');
  // 2020-04〜2021-03 と 2020-10〜2021-09 をつなぐと 2020-04〜2021-09 の 18 か月
  await registerProject(page, {
    organizationName: 'E2E 経験年数の組織',
    title: 'E2E 経験年数の実績 1',
    startedOn: '2020-04-01',
    endedOn: '2021-03-31',
    skills: ['E2E-Skill-Years'],
    isMasked: false,
  });
  await registerProject(page, {
    organizationName: 'E2E 経験年数の組織',
    title: 'E2E 経験年数の実績 2',
    startedOn: '2020-10-01',
    endedOn: '2021-09-30',
    skills: ['E2E-Skill-Years'],
    isMasked: false,
  });

  await page.goto('/dash/skills');
  const row = skillRow(page, 'E2E-Skill-Years');
  await expect(row.getByRole('cell')).toHaveText(['E2E-Skill-Years', '1 年 6 か月', '1 年 6 か月']);

  await openSkill(page, 'E2E-Skill-Years');
  await page.getByRole('textbox', { name: '年' }).fill('3');
  await page.getByRole('textbox', { name: 'か月' }).fill('2');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(row.getByRole('cell')).toHaveText([
    'E2E-Skill-Years',
    '3 年 2 か月（上書き）',
    '1 年 6 か月',
  ]);
});
