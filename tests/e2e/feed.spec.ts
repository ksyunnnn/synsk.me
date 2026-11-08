import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';

/**
 * 訪問者の一覧 `/timeline`（specs/005-feed/spec.md の User Story 1、contracts/visitor-feed.md）。
 * 値はすべて作り物。
 *
 * テストは同じ手元の D1 を並行して使う。ほかのテストの行より新しい日付（2099 年）で入れ、
 * 1 ページ目の先頭に並ぶようにする。終わったら消す
 */

const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

const ARTICLE = { url: 'https://example.com/e2e-feed-article', title: 'E2E の一覧の作り物の記事' };
const LIFE_EVENT = { slug: 'e2e-feed-life-event', title: 'E2E の一覧の作り物の出来事' };

test('外部の activity と life event が並びの日付の順に並び、キーボードでリンクを辿れる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);

  // 同じ日（2099-01-01）の外部の activity と life event
  await page.goto('/dash/activities/new');
  await page
    .getByRole('combobox', { name: '取得元' })
    .selectOption({ label: '登録していないサイト（手で入力する）' });
  await textbox(page, 'URL').fill(ARTICLE.url);
  await textbox(page, '題').fill(ARTICLE.title);
  await page.getByLabel('日付').fill('2099-01-01');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await page.goto('/dash/life-events/new');
  await textbox(page, '題').fill(LIFE_EVENT.title);
  await page.getByLabel('起きた日').fill('2099-01-01');
  await page.getByRole('button', { name: '作成する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await textbox(page, '識別子').fill(LIFE_EVENT.slug);
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  const lifeEventEditUrl = page.url().replace(/\?.*$/, '');

  const visitor = await browser.newPage();
  await visitor.goto('/timeline');
  const entries = visitor.getByRole('listitem');
  // 同じ日の life event は、その日の外部の activity より古く並ぶ（FR-011）
  await expect(entries.nth(0)).toContainText(ARTICLE.title);
  await expect(entries.nth(1)).toContainText(LIFE_EVENT.title);
  await expect(entries.nth(0)).toContainText('外部の activity・登録していないサイト');
  await expect(entries.nth(1)).toContainText('2099-01-01・life event');

  // 外部の activity は取得元の URL へ直接リンクする（FR-020）
  await expect(visitor.getByRole('link', { name: ARTICLE.title })).toHaveAttribute(
    'href',
    ARTICLE.url,
  );

  // キーボードだけで life event のページへ移る（constitution V）
  await visitor.getByRole('link', { name: LIFE_EVENT.title }).focus();
  await visitor.keyboard.press('Enter');
  await expect(visitor).toHaveURL(new RegExp(`/life-events/${LIFE_EVENT.slug}$`));
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(LIFE_EVENT.title);
  await visitor.close();

  // 消す
  await page.goto(lifeEventEditUrl);
  await page.getByRole('link', { name: 'この life event を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('life event を削除しました');
  await page.goto('/dash/activities');
  await page.getByRole('link', { name: ARTICLE.title, exact: true }).click();
  await page.getByRole('link', { name: 'この activity を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('外部の activity を削除しました');
});
