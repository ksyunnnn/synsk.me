import { expect, test } from '@playwright/test';

/**
 * JavaScript が読めない状態でも、ページが読めることを確かめる。
 *
 * 昇格の直後の数秒、エッジのキャッシュには新しい版の HTML があり、Worker は
 * まだ古い版で応答することがある。その窓に当たった訪問者は、HTML は受け取れる
 * がチャンクが 404 になり、ハイドレーションが効かない（#71）。
 *
 * この窓を消すにはエッジのキャッシュを昇格と同時に purge する必要があり、
 * そのための API トークンの権限を持っていない。ADR-0022 は窓を許容すると
 * 決めた。**許容できるのは、JS なしでもページが成立する間に限る。**その前提を
 * ここで固定する。
 */

test.describe('JavaScript なし', () => {
  test.use({ javaScriptEnabled: false });

  test('トップの題と見出しが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/synsk\.me/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('アーカイブへ遷移できる', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /2024/ }).first().click();
    await expect(page).toHaveURL(/\/archives\/2024$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
