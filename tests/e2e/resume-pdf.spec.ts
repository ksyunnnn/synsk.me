import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createLimitedResume,
  openVisitor,
  registerCareer,
  setResumeVisible,
  visit,
} from './support/dash';

/**
 * 職務経歴書の「PDF で保存」（specs/002-resume/spec.md の FR-029・FR-030、research.md の R11）。
 * サーバは PDF を作らない。ボタンは `window.print()` でブラウザの印刷の画面を開き、訪問者が
 * そこで PDF に保存する（src/features/resume/components/print-button.tsx）。印刷の画面は
 * headless のブラウザでは操作できないため、ここでは次の 2 つを確かめる。
 * - ボタンが印刷の画面を開く呼び出しをすること
 * - 印刷の見た目（`print` の media）で、ボタンを出さずに中身を出すこと
 *
 * 印刷の画面で保存した PDF の中身は確かめられない。中身が表示と同じ値になるのは、表示している
 * ページを印刷するためである。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

test('訪問者のページの「PDF で保存」は、ブラウザの印刷の画面を開き、印刷の見た目ではボタンを出さずに中身を出す', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: 'E2E PDF の組織',
    organizationNameMasked: 'E2E PDF の秘匿化した組織',
    role: 'E2E PDF の肩書',
    description: 'E2E PDF の本文',
  });
  const { url } = await createLimitedResume(page, {
    title: 'E2E PDF の職務経歴書',
    keep: /E2E PDF の組織/,
  });
  await setResumeVisible(page, true);

  const visitor = await openVisitor(browser);
  // 印刷の画面の代わりに、呼ばれた回数を数える
  await visitor.addInitScript(() => {
    const counter = window as unknown as { printCalls: number };
    counter.printCalls = 0;
    window.print = () => {
      counter.printCalls += 1;
    };
  });
  expect(await visit(visitor, new URL(url).pathname)).toBe(200);
  // ボタンはクライアントの部品。ハイドレーションの前に押しても何も起きない
  await visitor.waitForLoadState('networkidle');
  const button = visitor.getByRole('button', { name: 'PDF で保存' });
  await button.click();
  await expect
    .poll(() => visitor.evaluate(() => (window as unknown as { printCalls: number }).printCalls))
    .toBe(1);

  await visitor.emulateMedia({ media: 'print' });
  await expect(button).toBeHidden();
  await expect(visitor.getByRole('heading', { name: 'E2E PDF の組織' })).toBeVisible();
  await expect(visitor.getByText('E2E PDF の本文')).toBeVisible();
  await visitor.close();
});
