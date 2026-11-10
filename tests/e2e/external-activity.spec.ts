import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { tabTo, typeDate } from './support/dash';

/**
 * URL を指名した・手で入力した外部の activity の画面（specs/004-external-activity/spec.md の
 * User Story 4、FR-005・FR-010・FR-011・FR-033、constitution V）。外へ要求を出さないよう、手で入力する
 * 取得元（CodePen・登録していないサイト）で確かめる。テストは同じ手元の D1 を並行して使う。値は
 * ほかのテストと重ならないものにする
 */

test('オーナーはキーボードだけで外部の activity を登録し・書き換え・消せる（constitution V）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/activities');

  await tabTo(page, page.getByRole('link', { name: '外部の activity を登録する' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dash\/activities\/new$/);
  const source = page.getByRole('combobox', { name: '取得元', exact: true });
  await tabTo(page, source);
  await page.keyboard.type('CodeP');
  await expect(source).toHaveValue('codepen');
  await tabTo(page, page.getByRole('textbox', { name: 'URL', exact: true }));
  await page.keyboard.type('https://codepen.io/fake/pen/e2e-keyboard');
  await tabTo(page, page.getByRole('textbox', { name: '題', exact: true }));
  await page.keyboard.type('E2E キーボードのペン');
  const date = page.getByRole('textbox', { name: '日付', exact: true });
  await tabTo(page, date);
  await typeDate(page, date, '2019-09-13');
  await tabTo(page, page.getByRole('button', { name: '登録する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await tabTo(page, page.getByRole('link', { name: 'E2E キーボードのペン', exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('textbox', { name: '題', exact: true }));
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('E2E キーボードのペン（直した）');
  await tabTo(page, page.getByRole('button', { name: '保存する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E キーボードのペン（直した）',
  );

  await tabTo(page, page.getByRole('link', { name: 'この activity を削除する' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: '削除する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('外部の activity を削除しました');
  await expect(page.getByRole('link', { name: 'E2E キーボードのペン（直した）' })).toHaveCount(0);
});

test('日付の無い登録は保存されず、日付を入れるよう示され、入力が残る（FR-011）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/activities/new');
  await page.getByRole('combobox', { name: '取得元', exact: true }).selectOption('codepen');
  await page
    .getByRole('textbox', { name: 'URL', exact: true })
    .fill('https://codepen.io/fake/pen/e2e-no-date');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 日付の無いペン');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(page.getByText('日付を入力してください')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 日付の無いペン',
  );
});

test('登録していないサイトの記事を登録でき、同じ URL は拒む（FR-005）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const register = async () => {
    await page.goto('/dash/activities/new');
    await page.getByRole('combobox', { name: '取得元', exact: true }).selectOption('unlisted');
    await page
      .getByRole('textbox', { name: 'URL', exact: true })
      .fill('https://example.com/e2e-unlisted');
    await page
      .getByRole('textbox', { name: '題', exact: true })
      .fill('E2E 登録していないサイトの記事');
    await page.getByRole('textbox', { name: '日付', exact: true }).fill('2018-01-01');
    await page.getByRole('button', { name: '登録する' }).click();
  };

  await register();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'E2E 登録していないサイトの記事' }),
  ).toContainText('登録していないサイト');

  await register();
  await expect(page.getByText('この URL は登録してあります')).toBeVisible();

  await page.goto('/dash/activities');
  await page.getByRole('link', { name: 'E2E 登録していないサイトの記事', exact: true }).click();
  await page.getByRole('link', { name: 'この activity を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('外部の activity を削除しました');
});
