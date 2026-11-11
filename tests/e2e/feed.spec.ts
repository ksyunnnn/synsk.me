import { expect, test } from '@playwright/test';

/**
 * 一覧の画面（開発中の `/` の置き場 `/top-draft`）のページ送り（specs/005-feed/tasks.md の T064、
 * research.md の R8）。ページ送りは `<a>` なので、JavaScript なしでも移れる。
 *
 * テストは同じ手元の D1 を並行して使い、並ぶ件数が決まらない。件数に依らない最後のページの先を
 * 使う。1 ページ目と 2 ページ目の中身と次のページへのリンクは tests/integration/feed.test.ts が
 * 作り物の行で確かめる
 */

/** どの D1 でも最後のページの先になる番号 */
const BEYOND_LAST = '/top-draft?page=99999';

for (const javaScriptEnabled of [true, false]) {
  test.describe(`JavaScript ${javaScriptEnabled ? 'あり' : 'なし'}`, () => {
    test.use({ javaScriptEnabled });

    test('最後のページの先は「まだ何もない」でなく 1 ページ目へのリンクを出し、たどると 1 ページ目に移る', async ({
      page,
    }) => {
      const response = await page.goto(BEYOND_LAST);
      expect(response?.status()).toBe(200);
      await expect(page.getByText('まだ何もない')).toHaveCount(0);
      await expect(page.getByRole('link', { name: '次のページ' })).toHaveCount(0);

      await page.getByRole('link', { name: '1 ページ目へ' }).click();
      await expect(page).toHaveURL(/\/top-draft$/);
      await expect(page.getByRole('link', { name: '1 ページ目へ' })).toHaveCount(0);
    });
  });
}
