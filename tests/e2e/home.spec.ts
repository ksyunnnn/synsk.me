import { expect, test } from '@playwright/test';

/**
 * 実ブラウザでしか確かめられないものを書く。見本である。
 *
 * ここに書くもの。
 * - ハイドレーション後のふるまい（`useEffect` が走った結果、クリックへの反応）
 * - 操作の連なり（書く → 画像を貼る → 公開する）
 * - 見た目の退行（スクリーンショットの比較）
 *
 * ここに書かないもの。
 * - HTTP の状態コードとヘッダ → `tests/integration/` が `createTestHarness()` で担う
 * - 純関数とソースの静的な検査 → `tests/unit/`
 * - D1 の読み書き → `tests/workers/`
 *
 * ブラウザの起動は 1 本ごとに実時間を足す。層を間違えると PR の CI の予算
 * （ADR-0019 の Tolerable 10 分）を割る。
 */

test.describe('トップ', () => {
  test('題と見出しが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/synsk\.me/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('アーカイブへ移動できる', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /2024/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/archives\/2024$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('ハイドレーションが警告なく終わる', async ({ page }) => {
    // React のハイドレーション不一致は pageerror ではなく console.error に出る
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text());
    });

    await page.goto('/');
    // ハイドレーションの完了を待つ。React がクライアント側の island を
    // 立ち上げるまで、body の data 属性は付かない
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
