import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';

/**
 * life event と、手で入力する外部の activity の画面（specs/004-external-activity/spec.md の
 * User Story 4・5、contracts/dash.md）。値はすべて作り物。
 *
 * テストは同じ手元の D1 を並行して使う。題と URL は、ほかのテストと重ならない値にする。
 * URL を指名する取得元は外のサービスに要求を出すため、E2E では扱わない（単体の検査が持つ）
 */

const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

test('life event を作り、訪問者のページで読み、書き換え、削除できる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/life-events/new');
  // リンク先を入れる項目を持たない（User Story 5 の 7）
  await expect(page.getByRole('textbox', { name: /URL|リンク/ })).toHaveCount(0);

  // 起きた日を入れずに作ると、入力が残り、理由が出る（User Story 5 の 2）
  await textbox(page, '題').fill('E2E の作り物の出来事');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(page.getByText('起きた日を入力してください')).toBeVisible();
  await expect(textbox(page, '題')).toHaveValue('E2E の作り物の出来事');

  await page.getByLabel('起きた日').fill('2020-04-01');
  await textbox(page, '説明').fill('E2E の作り物の説明');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  // 作ったときの識別子は uid（User Story 5 の 8）
  await expect(textbox(page, '識別子')).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  const editUrl = page.url().replace(/\?.*$/, '');

  // 識別子を書き換え、訪問者として開く（User Story 5 の 9）
  await textbox(page, '識別子').fill('e2e-fake-life-event');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  const visitor = await browser.newPage();
  await visitor.goto('/life-events/e2e-fake-life-event');
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E の作り物の出来事');
  await expect(visitor.getByText('2020-04-01')).toBeVisible();
  await expect(visitor.getByText('E2E の作り物の説明')).toBeVisible();

  // キーボードだけで削除する（constitution V）
  await page.goto(editUrl);
  await page.getByRole('link', { name: 'この life event を削除する' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('life event を削除する');
  await page.getByRole('button', { name: '削除する' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('life event を削除しました');

  const gone = await visitor.goto('/life-events/e2e-fake-life-event');
  expect(gone?.status()).toBe(404);
  await visitor.close();
});

test('登録していないサイトの activity を手で入力して登録し、削除できる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/activities/new');

  // キーボードだけで取得元を選び、入力する（constitution V）
  const source = page.getByRole('combobox', { name: '取得元' });
  await source.focus();
  await source.selectOption({ label: '登録していないサイト（手で入力する）' });
  await textbox(page, 'URL').focus();
  await page.keyboard.type('https://example.com/e2e-fake-article');
  await textbox(page, '題').focus();
  await page.keyboard.type('E2E の作り物の記事');

  // 日付を入れずに登録すると、理由が出る（FR-011）
  await page.getByRole('button', { name: '登録する' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('日付を入力してください')).toBeVisible();

  await page.getByLabel('日付').fill('2024-05-01');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await page.goto('/dash/activities');
  await page.getByRole('link', { name: 'E2E の作り物の記事', exact: true }).click();
  await page.getByRole('link', { name: 'この activity を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('外部の activity を削除しました');
  await expect(page.getByRole('link', { name: 'E2E の作り物の記事', exact: true })).toHaveCount(0);
});
