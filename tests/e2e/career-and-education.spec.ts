import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';

/**
 * 入力は `getByRole` で探す。画面を移った後も、前の画面が隠れて DOM に残ることがある
 * （2026-11-04 に、登録の画面から編集の画面へ移った後で確かめた）。`getByLabel` は隠れた画面の
 * 同じ名前の入力も拾い、`getByRole` は隠れた要素を除く。
 *
 * 作り手としての職歴と学歴の登録・編集・削除と、同じ職歴を 2 つのタブで開いたときに後から
 * 保存した側が止まり入力が残ること（specs/001-career-and-project/spec.md の FR-007・FR-036・
 * FR-042・FR-044）。HTTP の状態コードと D1 の行は結合の検査が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const fillCareer = async (page: Page, organizationName: string, role: string) => {
  await page.getByRole('textbox', { name: '組織名', exact: true }).fill(organizationName);
  await page.getByRole('textbox', { name: '秘匿化した組織名' }).fill('E2E の会社');
  await page.getByRole('textbox', { name: '肩書' }).fill(role);
  await page.getByRole('textbox', { name: '始まりの日' }).fill('2020-04-01');
};

test('職歴を登録・編集・削除できる', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillCareer(page, 'E2E の作り物の組織 1', 'E2E の肩書');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('radio', { name: '秘匿化する', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();

  await page.getByRole('textbox', { name: '肩書' }).fill('E2E で直した肩書');
  await page.getByRole('radio', { name: 'サイトに載せる', exact: true }).check();
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('textbox', { name: '肩書' })).toHaveValue('E2E で直した肩書');
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('radio', { name: 'サイトに載せる', exact: true })).toBeChecked();

  await page.getByRole('link', { name: 'この職歴を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('職歴を削除しました');
  await expect(page.getByRole('link', { name: /E2E で直した肩書/ })).toHaveCount(0);
});

test('同じ職歴を 2 つのタブで開くと、後から保存した側は止まり、入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillCareer(page, 'E2E の作り物の組織 2', 'E2E の同時編集');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  const editUrl = page.url().replace(/\?.*$/, '');

  const other = await context.newPage();
  await other.goto(editUrl);

  await page.getByRole('textbox', { name: '肩書' }).fill('先に保存した肩書');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('textbox', { name: '肩書' })).toHaveValue('先に保存した肩書');

  await other.getByRole('textbox', { name: '肩書' }).fill('後から保存した肩書');
  await other.getByRole('button', { name: '保存する' }).click();
  await expect(other.getByRole('alert')).toContainText('別の画面で書き換えられていました');
  await expect(other.getByRole('textbox', { name: '肩書' })).toHaveValue('後から保存した肩書');

  await other.goto(editUrl);
  await expect(other.getByRole('textbox', { name: '肩書' })).toHaveValue('先に保存した肩書');
});

test('学歴を登録・編集・削除できる', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/educations/new');
  await page.getByRole('textbox', { name: '学校' }).fill('E2E の作り物大学');
  await page.getByRole('textbox', { name: '始まりの日' }).fill('2014-04-01');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await page.getByRole('link', { name: 'E2E の作り物大学' }).click();
  await page.getByRole('textbox', { name: '学部' }).fill('E2E の作り物学部');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(
    page.getByRole('link', { name: 'E2E の作り物大学・E2E の作り物学部' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'E2E の作り物大学・E2E の作り物学部' }).click();
  await page.getByRole('link', { name: 'この学歴を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('学歴を削除しました');
  await expect(page.getByRole('link', { name: /E2E の作り物大学/ })).toHaveCount(0);
});
