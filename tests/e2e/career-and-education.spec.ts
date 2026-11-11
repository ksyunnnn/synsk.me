import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { fillCareer } from './support/dash';

/**
 * 入力は `getByRole` で探す。画面を移った後も、前の画面が隠れて DOM に残ることがある
 * （2026-11-04 に、登録の画面から編集の画面へ移った後で確かめた）。`getByLabel` は隠れた画面の
 * 同じ名前の入力も拾い、`getByRole` は隠れた要素を除く。
 *
 * オーナーとしての職歴と学歴の登録・編集・削除と、同じ職歴を 2 つのタブで開いたときに後から
 * 保存した側が止まり入力が残ること（specs/001-career-and-project/spec.md の FR-007・FR-036・
 * FR-042・FR-044）。HTTP の状態コードと D1 の行は結合の検査が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** 登録の画面で、テストごとの組織名と肩書を入れる */
const fillNewCareer = (page: Page, organizationName: string, role: string) =>
  fillCareer(page, {
    organizationName,
    organizationNameMasked: 'E2E の会社',
    role,
    startedOn: '2020-04-01',
  });

test('職歴を登録・編集・削除できる', async ({ page, context }) => {
  // 失敗した回の行は消えずに残る。retry と繰り返しで前の回の行を拾わないよう、回ごとに変える
  const editedRole = `E2E で直した肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillNewCareer(page, 'E2E の作り物の組織 1', 'E2E の肩書');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('radio', { name: '秘匿化する', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();

  // 保存した後の画面が描き直されるまで待つ。画面に出る値は保存の前と変わらないため、
  // 保存のたびに変わる更新日時（楽観ロックの隠れた入力）で見分ける。描き直しの前にリンクを
  // 押すと、vinext 1.2 は後から描いた保存の結果の画面を残し、削除の確認画面へ移らない
  // （2026-11-08 に、CPU を絞った手元の E2E で、保存の応答の後・描き直しの前に押した回で確かめた）
  const openedUpdatedAt = page.locator('input[name="openedUpdatedAt"]');
  const updatedAtBeforeSave = await openedUpdatedAt.inputValue();
  await page.getByRole('textbox', { name: '肩書' }).fill(editedRole);
  await page.getByRole('radio', { name: 'サイトに載せる', exact: true }).check();
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(openedUpdatedAt).not.toHaveValue(updatedAtBeforeSave);
  await expect(page.getByRole('textbox', { name: '肩書' })).toHaveValue(editedRole);
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('radio', { name: 'サイトに載せる', exact: true })).toBeChecked();

  await page.getByRole('link', { name: 'この職歴を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('職歴を削除しました');
  await expect(page.getByRole('link', { name: new RegExp(editedRole) })).toHaveCount(0);
});

test('同じ職歴を 2 つのタブで開くと、後から保存した側は止まり、入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillNewCareer(page, 'E2E の作り物の組織 2', 'E2E の同時編集');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  const editUrl = page.url().replace(/\?.*$/, '');

  const other = await context.newPage();
  await other.goto(editUrl);

  // 先の保存が D1 に書き終わるまで待つ。入力の値は保存の前から同じなので、保存のたびに変わる
  // 更新日時（楽観ロックの隠れた入力）で見分ける。待たずに後の保存を送ると、先の保存より前に
  // 書き終わることがあり、後の保存が止まらない（2026-11-09 に、20 回のうち 3 回で起きた）
  const openedUpdatedAt = page.locator('input[name="openedUpdatedAt"]');
  const updatedAtBeforeSave = await openedUpdatedAt.inputValue();
  await page.getByRole('textbox', { name: '肩書' }).fill('先に保存した肩書');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(openedUpdatedAt).not.toHaveValue(updatedAtBeforeSave);
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
