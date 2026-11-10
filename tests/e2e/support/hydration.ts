import { expect, type Page } from '@playwright/test';
import { textbox } from './dash';
import { waitForHydration } from './note';

/**
 * JavaScript が動く前（hydration の前）の入力を確かめる道具。react-dom 19.3.1 の hydration は、
 * 初めの値を持つ `<textarea>` の値を初めの値に戻す（`initTextarea`）
 */

/**
 * 画面のスクリプトの読み込みを止める。返した関数を呼ぶと、止めていた読み込みを流し、それ以降は
 * 止めない。止めている要求が残るうちに経路の登録を外すと、Playwright が二重の処理として止まる
 */
export const holdScripts = async (page: Page) => {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await released;
    await route.fallback();
  });
  return release;
};

/** スクリプトを止めて `url` を開き、動く前に `label` の入力へ打ってから動かす */
export const typeBeforeHydration = async (
  page: Page,
  url: string,
  typed: string,
  label = '本文',
) => {
  const release = await holdScripts(page);
  await page.goto(url, { waitUntil: 'commit' });
  await textbox(page, label).fill(typed);
  release();
  await waitForHydration(textbox(page, label));
  await expect(textbox(page, label)).toHaveValue(typed);
};
