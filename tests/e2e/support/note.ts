import type { Locator, Page } from '@playwright/test';

/**
 * note の E2E が使う道具。
 *
 * E2E のテストは同じローカルの D1 を並行して使う。slug はテストごとに重ならない
 * ものにする。
 */

/** テストごとに重ならない slug */
export const uniqueSlug = (label: string) =>
  `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 作る画面・編集の画面の入力 */
export const noteFields = (page: Page) => ({
  slug: page.getByLabel('slug'),
  title: page.getByLabel('題'),
  body: page.getByLabel('本文'),
});

/** 新しい note の画面で入力して「作る」を押す */
export const createNote = async (
  page: Page,
  values: { slug: string; title: string; body: string },
) => {
  await page.goto('/dash/notes/new');
  const fields = noteFields(page);
  await fields.slug.fill(values.slug);
  await fields.title.fill(values.title);
  await fields.body.fill(values.body);
  await page.getByRole('button', { name: '作る' }).click();
};

/**
 * Tab キーだけで、要素にフォーカスを移す。マウスもフォーカスを移す API も使わない。
 * 届かなければ、キーボードで操作できないとして失敗する
 */
export const tabTo = async (page: Page, target: Locator, maxPresses = 40) => {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab キーを ${maxPresses} 回押しても要素にフォーカスが届かない`);
};

/** 横にはみ出さず、横に送らなくても操作できる幅に収まっている */
export const fitsViewportWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
