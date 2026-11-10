import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { saveEdit, textbox } from './support/dash';
import { createNote, openNoteEditor, uniqueNoteSlug, waitForHydration } from './support/note';

/**
 * 書きかけの note の保持（specs/003-note/spec.md の FR-018・FR-019、User Story 4 の 1・2、
 * research.md の R10）。書きかけは共有担当の `DraftRetainingForm` がブラウザの `localStorage` に
 * 持ち、テストごとの context は別の保存先を持つ。書きかけは画面の JavaScript が動き始めた後の
 * 入力だけを持つため、書き込まれるまで入れ直す
 */

const noteDraftKeys = (page: Page) =>
  page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft:note:')),
  );

const fillUntilDrafted = (page: Page, value: string) =>
  expect
    .poll(async () => {
      await textbox(page, '本文').fill(value);
      return (await noteDraftKeys(page)).length > 0;
    })
    .toBe(true);

test('本文を書きかけて保存せずに再読み込みすると、書きかけが残る（User Story 4 の 1）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, { slug: uniqueNoteSlug('draft'), title: 'E2E 書きかけ' });
  await openNoteEditor(page, editUrl);
  await fillUntilDrafted(page, 'E2E 保存していない本文');
  await page.reload();
  await expect(textbox(page, '本文')).toHaveValue('E2E 保存していない本文');
});

test('別のブラウザの文脈で開くと、書きかけは出ず、最後に保存した版が出る（User Story 4 の 2）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('device'),
    title: 'E2E 別の端末',
    body: 'E2E 最後に保存した本文',
  });
  await openNoteEditor(page, editUrl);
  await fillUntilDrafted(page, 'E2E この端末だけの書きかけ');

  // 別の context は別の localStorage を持つ。別の端末にあたる
  const otherContext = await browser.newContext();
  await actAsAuthor(otherContext);
  const other = await otherContext.newPage();
  await openNoteEditor(other, editUrl);
  await expect(textbox(other, '本文')).toHaveValue('E2E 最後に保存した本文');
  await otherContext.close();
});

test('保存を止められたとき、書きかけが消えない（spec の Edge Cases）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('conflict-draft'),
    title: 'E2E 止められた書きかけ',
  });
  await openNoteEditor(page, editUrl);
  const other = await context.newPage();
  await openNoteEditor(other, editUrl);
  await textbox(other, '本文').fill('先に保存した本文');
  await saveEdit(other);
  await other.close();

  await fillUntilDrafted(page, 'E2E 止められる前の書きかけ');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('alert')).toContainText('別の画面で保存されていました');

  // 書きかけは、開いたときの版の名前のまま持ち続ける。開き直しても自動では戻さない（R10）
  await page.reload();
  const drafts = await page.evaluate(() =>
    Object.entries(window.localStorage)
      .filter(([key]) => key.startsWith('synsk:draft:note:'))
      .map(([, value]) => value),
  );
  expect(drafts.some((value) => value.includes('E2E 止められる前の書きかけ'))).toBe(true);
  await expect(textbox(page, '本文')).toHaveValue('先に保存した本文');
});

/** 前の版から書いた書きかけの知らせ。編集の画面のフォームの上に出る */
const staleNotice = (page: Page) => page.getByRole('region', { name: '前の版の書きかけ' });

/**
 * 前の版の書きかけの知らせが出ていないことを確かめる。知らせは画面の JavaScript が書きかけを
 * 探した後に出るので、探し終えた印（`data-draft-stale-checked`）を待ってから数える
 */
const expectNoStaleNotice = async (page: Page) => {
  await expect(
    page.locator('form[data-draft-stale-checked]').filter({ visible: true }),
  ).toHaveCount(1);
  await expect(staleNotice(page)).toHaveCount(0);
};

/** 前の版の書きかけを知らせる文 */
const STALE_MESSAGE = 'この画面を開く前の版から書いた書きかけ';

/** 開き直し、本文の入力が hydration し終えるまで待つ */
const reopen = async (page: Page) => {
  await page.reload();
  await waitForHydration(textbox(page, '本文'));
};

/**
 * 編集の画面を開いた後、別の画面で先に保存させ、開いていた画面で書きかけを残して開き直す。
 * 残した書きかけは、前の版のものになる
 */
const leaveStaleDraft = async (page: Page, editUrl: string, draft: string) => {
  await openNoteEditor(page, editUrl);
  const other = await page.context().newPage();
  await openNoteEditor(other, editUrl);
  await textbox(other, '本文').fill('先に保存した本文');
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, draft);
  await reopen(page);
};

test('先に保存された後に開き直すと、前の版の書きかけを知らせ、戻すと入力に入り、取り消せる（spec の Edge Cases）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('stale-restore'),
    title: 'E2E 前の版の書きかけを戻す',
  });
  await leaveStaleDraft(page, editUrl, 'E2E 前の版の書きかけ');

  await expect(staleNotice(page)).toContainText(STALE_MESSAGE);
  await expect(textbox(page, '本文')).toHaveValue('先に保存した本文');

  await staleNotice(page).getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(textbox(page, '本文')).toHaveValue('E2E 前の版の書きかけ');
  await expect(staleNotice(page)).toContainText('書きかけで変えた項目を戻しました');

  await staleNotice(page).getByRole('button', { name: '取り消す' }).click();
  await expect(textbox(page, '本文')).toHaveValue('先に保存した本文');
  await expect(staleNotice(page)).toContainText(STALE_MESSAGE);

  // 戻した書きかけは、この版の書きかけになる。開き直すと入力に入り、知らせは出ない
  await staleNotice(page).getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(textbox(page, '本文')).toHaveValue('E2E 前の版の書きかけ');
  await reopen(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E 前の版の書きかけ');
  await expectNoStaleNotice(page);
});

test('前の版の書きかけを捨てると知らせが変わり、取り消すと残り、捨てて開き直すと出ない', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('stale-discard'),
    title: 'E2E 前の版の書きかけを捨てる',
  });
  await leaveStaleDraft(page, editUrl, 'E2E 捨てる書きかけ');

  await staleNotice(page).getByRole('button', { name: '書きかけを捨てる' }).click();
  await expect(staleNotice(page)).toContainText('書きかけを捨てました');
  await expect(textbox(page, '本文')).toHaveValue('先に保存した本文');
  await staleNotice(page).getByRole('button', { name: '取り消す' }).click();
  await expect(staleNotice(page)).toContainText(STALE_MESSAGE);
  await reopen(page);
  await expect(staleNotice(page)).toContainText(STALE_MESSAGE);

  await staleNotice(page).getByRole('button', { name: '書きかけを捨てる' }).click();
  await expect(staleNotice(page)).toContainText('書きかけを捨てました');
  await reopen(page);
  await expectNoStaleNotice(page);
  await expect(textbox(page, '本文')).toHaveValue('先に保存した本文');
  expect(await noteDraftKeys(page)).toEqual([]);
});

test('前の版の書きかけが 2 つ以上あると、書いた日時の新しいものから 1 件ずつ知らせ、日時の無いものは後に回す', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('stale-order'),
    title: 'E2E 前の版の書きかけの順',
  });
  await openNoteEditor(page, editUrl);
  const key = await page.locator('form[data-draft-key]').getAttribute('data-draft-key');
  if (key === null) throw new Error('書きかけの名前が無い');
  const stem = key.replace(/@[^@]*$/, '');
  // 日時を持たない形式の書きかけ 2 つと、日時を持つ書きかけ 2 つを、別の版の名前で置く。
  // 名前の順と日時の順を逆にする
  await page.evaluate((stem) => {
    const put = (version: string, value: unknown) =>
      window.localStorage.setItem(`${stem}@${version}`, JSON.stringify(value));
    put('a-newer', { writtenAt: '2026-02-01T00:00:00.000Z', values: { body: ['E2E 新しい'] } });
    put('b-older', { writtenAt: '2026-01-01T00:00:00.000Z', values: { body: ['E2E 古い'] } });
    put('d-undated', { body: ['E2E 日時なしの 2 つ目'] });
    put('c-undated', { body: ['E2E 日時なしの 1 つ目'] });
  }, stem);
  await reopen(page);

  for (const body of ['E2E 新しい', 'E2E 古い', 'E2E 日時なしの 1 つ目', 'E2E 日時なしの 2 つ目']) {
    await staleNotice(page).getByRole('button', { name: '書きかけを戻す' }).click();
    await expect(textbox(page, '本文')).toHaveValue(body);
    await staleNotice(page).getByRole('button', { name: '取り消す' }).click();
    await staleNotice(page).getByRole('button', { name: '書きかけを捨てる' }).click();
    await expect(staleNotice(page)).toContainText('書きかけを捨てました');
    await reopen(page);
  }
  await expectNoStaleNotice(page);
});

/** 編集の画面の書きかけの名前から、版を除いた部分。別の版の書きかけを置くのに使う */
const draftStem = async (page: Page) => {
  const key = await page.locator('form[data-draft-key]').getAttribute('data-draft-key');
  if (key === null) throw new Error('書きかけの名前が無い');
  return key.replace(/@[^@]*$/, '');
};

test('送って応答が無いまま先に保存された書きかけも、保存の知らせの無い画面で開き直すと知らせる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('stale-unsent'),
    title: 'E2E 応答の無かった書きかけ',
  });
  await openNoteEditor(page, editUrl);
  const stem = await draftStem(page);
  // 送信が応答を返さずに失敗すると、送った印（synsk:draft-sent）が前の版の書きかけを指したまま残る
  await page.evaluate((stem) => {
    const key = `${stem}@failed-send`;
    window.localStorage.setItem(
      key,
      JSON.stringify({
        writtenAt: '2026-01-01T00:00:00.000Z',
        values: { body: ['E2E 届かなかった本文'] },
      }),
    );
    window.localStorage.setItem('synsk:draft-sent', key);
  }, stem);
  await reopen(page);

  await expect(staleNotice(page)).toContainText(STALE_MESSAGE);
  await staleNotice(page).getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(textbox(page, '本文')).toHaveValue('E2E 届かなかった本文');
});

test('知らせのボタンをキーボードで押すと、入れ替わったボタンに焦点が移る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('stale-focus'),
    title: 'E2E 知らせの焦点',
  });
  await openNoteEditor(page, editUrl);
  const stem = await draftStem(page);
  await page.evaluate((stem) => {
    window.localStorage.setItem(
      `${stem}@older`,
      JSON.stringify({
        writtenAt: '2026-01-01T00:00:00.000Z',
        values: { body: ['E2E 焦点の書きかけ'] },
      }),
    );
  }, stem);
  await reopen(page);

  const restore = staleNotice(page).getByRole('button', { name: '書きかけを戻す' });
  const discard = staleNotice(page).getByRole('button', { name: '書きかけを捨てる' });
  const undo = staleNotice(page).getByRole('button', { name: '取り消す' });
  await restore.focus();
  await page.keyboard.press('Enter');
  await expect(undo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(restore).toBeFocused();
  await discard.focus();
  await page.keyboard.press('Enter');
  await expect(undo).toBeFocused();
});
