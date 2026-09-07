import { expect, test } from '@playwright/test';

/**
 * 見た目の退行を捕まえる。見本である。
 *
 * 基準画像は CI の固定環境でだけ撮る。手元では撮らない。Playwright 公式が
 * 環境差を明記している。
 *
 * > Browser rendering can vary based on the host OS, version, settings,
 * > hardware, power source (battery vs. power adapter), headless mode, and
 * > other factors.
 * > https://playwright.dev/docs/test-snapshots
 *
 * macOS で撮った基準画像は Linux の runner と一致しない。基準画像は
 * `tests/e2e/__screenshots__/` に置き、Linux のものだけを追跡する。
 */

test.describe('見た目', () => {
  test('トップの見た目が変わっていない', async ({ page }) => {
    await page.goto('/');
    // ハイドレーションと Web フォントの適用を待つ
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      // 反対色のわずかな差で落ちないようにする
      maxDiffPixelRatio: 0.01,
      // 「工事中」のアイコンが animate-bounce で動く
      animations: 'disabled',
    });
  });
});
