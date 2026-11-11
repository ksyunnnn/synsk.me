import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { openVisitor, saveEdit, submitAndWait, tabTo, textbox, visit } from './support/dash';
import {
  createNote,
  openNoteEditor,
  uniqueNoteSlug as uniqueSlug,
  waitForHydration,
} from './support/note';

/**
 * オーナーとしての note の作成・保存・公開（specs/003-note/spec.md の User Story 1、FR-001・
 * FR-003・FR-011、constitution V）。HTTP の状態コードと D1 の行は結合と workerd の検査が持つ
 */

test('note を作って保存し、公開すると訪問者が読め、識別子が読み取りだけになる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('publish');
  // 題は一覧のリンクの名前になる。手元で繰り返し回すと D1 に残った前の回の note と重なるため、
  // 識別子を含めて重ならない値にする
  const title = `E2E の note の題 ${slug}`;
  await createNote(page, { slug, title });
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
  await expect(textbox(page, '識別子')).toBeEditable();

  await textbox(page, '本文').fill('E2E の直した本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E の直した本文');

  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('status')).toHaveText('公開しました');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
  await expect(textbox(page, '識別子')).toHaveCount(0);
  await expect(page.getByText(slug, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '訪問者に見せるページを開く' })).toHaveAttribute(
    'href',
    `/notes/${slug}`,
  );

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, `/notes/${slug}`)).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(visitor.getByText('E2E の直した本文')).toBeVisible();
  await visitor.close();

  await page.goto('/dash/notes');
  await expect(page.getByRole('link', { name: title })).toBeVisible();
});

test('題が空の note は公開できず、題を入れるよう示される（FR-011）', async ({ page, context }) => {
  await actAsAuthor(context);
  await createNote(page, { slug: uniqueSlug('untitled'), title: '' });
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('alert')).toContainText('題が空の版は公開できません');
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
});

test('キーボードだけで note を作り、保存し、公開できる（constitution V）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('keyboard');
  await page.goto('/dash/notes/new');
  await waitForHydration(textbox(page, '本文'));

  await tabTo(page, textbox(page, '識別子'));
  await page.keyboard.type(slug);
  await tabTo(page, textbox(page, '題'), 5);
  await page.keyboard.type('E2E のキーボードの題');
  await tabTo(page, textbox(page, '本文'), 5);
  await page.keyboard.type('E2E のキーボードの本文');
  await tabTo(page, page.getByRole('button', { name: '作る' }), 5);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await waitForHydration(textbox(page, '本文'));

  await tabTo(page, textbox(page, '本文'));
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('E2E のキーボードの本文、足した');
  await tabTo(page, page.getByRole('button', { name: '保存する' }), 5);
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(textbox(page, '本文')).toHaveValue('E2E のキーボードの本文、足した');

  await tabTo(page, page.getByRole('button', { name: '最も新しい版を公開する' }));
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
});

test('転載先を 2 つ記録でき、同じ URL を別の note に記録すると拒まれる（User Story 7）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const suffix = crypto.randomUUID().slice(0, 8);
  const first = `https://example.com/e2e-syndication-${suffix}-1`;
  const second = `https://example.com/e2e-syndication-${suffix}-2`;

  await createNote(page, { slug: uniqueSlug('syndication-a'), title: 'E2E 転載先 A' });
  // 2 つ目はスキームとホスト名の大文字とフラグメントを付けて入れる。normalizeWebUrl で揃えた値で
  // 記録する（ADR-0006、T058）
  for (const url of [first, `HTTPS://EXAMPLE.com/e2e-syndication-${suffix}-2#top`]) {
    await textbox(page, '転載先の URL').fill(url);
    await submitAndWait(page, '転載先を記録する');
    await expect(page.getByRole('status')).toHaveText('転載先を記録しました');
  }
  await expect(page.getByText(first, { exact: true })).toBeVisible();
  await expect(page.getByText(second, { exact: true })).toBeVisible();

  // 揃えると 1 つ目と同じになる URL は、別の note に記録できない（FR-032）
  const sameAsFirst = `https://Example.COM/e2e-syndication-${suffix}-1#section`;
  await createNote(page, { slug: uniqueSlug('syndication-b'), title: 'E2E 転載先 B' });
  await textbox(page, '転載先の URL').fill(sameAsFirst);
  await submitAndWait(page, '転載先を記録する');
  await expect(page.getByText('この URL は、この note かほかの note に記録済みです')).toBeVisible();
  await expect(textbox(page, '転載先の URL')).toHaveValue(sameAsFirst);

  // 拒まれた後に別の URL を記録すると、前の知らせと入力が残らない
  const third = `https://example.com/e2e-syndication-${suffix}-3`;
  await textbox(page, '転載先の URL').fill(third);
  await submitAndWait(page, '転載先を記録する');
  await expect(page.getByRole('status')).toHaveText('転載先を記録しました');
  await expect(page.getByText(third, { exact: true })).toBeVisible();
  await expect(page.getByText('この URL は、この note かほかの note に記録済みです')).toHaveCount(
    0,
  );
  await expect(textbox(page, '転載先の URL')).toHaveValue('');
});

test('続けて保存しても、保存できた書きかけがその端末に残らない（FR-019）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueSlug('drafts'),
    title: 'E2E の書きかけの題',
  });
  // 1 回目の保存で `?saved=1` へ移り、2 回目の保存で同じ URL へ移る形にするため、開き直す
  await openNoteEditor(page, editUrl);
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
  for (const body of ['E2E の 1 回目', 'E2E の 2 回目']) {
    await textbox(page, '本文').fill(body);
    await saveEdit(page);
    await expect(textbox(page, '本文')).toHaveValue(body);
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft')),
      ),
    )
    .toEqual([]);
});

test('識別子を書きかけたまま公開すると、識別子は公開した値に戻り、続けて保存できる（FR-003）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('lock');
  await createNote(page, { slug, title: 'E2E の識別子の題' });
  await textbox(page, '識別子').fill(`${slug}-changed`);
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
  await expect(page.getByText(slug, { exact: true })).toBeVisible();

  await textbox(page, '本文').fill('E2E の公開した後の本文');
  await saveEdit(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(slug, { exact: true })).toBeVisible();
  await expect(textbox(page, '本文')).toHaveValue('E2E の公開した後の本文');
});

test('キーボードだけで下書きに戻し、削除し、元に戻せる（constitution V、T054）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('keyboard-lifecycle');
  const title = `E2E のキーボードの状態の題 ${slug}`;
  const editUrl = await createNote(page, { slug, title });

  /** Tab のキーだけで `target` に移り、Enter で押して、送った操作の応答を待つ */
  const pressWithKeyboard = async (name: string, role: 'button' | 'link' = 'button') => {
    await tabTo(page, page.getByRole(role, { name }));
    await Promise.all([
      role === 'button'
        ? page.waitForResponse((res) => res.request().method() === 'POST')
        : page.waitForURL((url) => url.pathname.endsWith('/delete')),
      page.keyboard.press('Enter'),
    ]);
  };

  await pressWithKeyboard('最も新しい版を公開する');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();

  await pressWithKeyboard('下書きに戻す');
  await expect(page.getByRole('status')).toHaveText('下書きに戻しました');
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();

  await pressWithKeyboard('この note を削除する', 'link');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('note を削除する');
  await waitForHydration(page.getByRole('button', { name: '削除する' }));
  await pressWithKeyboard('削除する');
  await expect(page.getByRole('status')).toHaveText('note を削除しました');

  await page.goto(editUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('削除した note');
  await waitForHydration(page.getByRole('button', { name: '元に戻す' }));
  await pressWithKeyboard('元に戻す');
  await expect(page.getByRole('status')).toHaveText('元に戻しました');
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
});

test('キーボードだけで過去の版を開き、その版に戻せる（constitution V、T055）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('keyboard-revert');
  const editUrl = await createNote(page, {
    slug,
    title: `E2E のキーボードの版の題 ${slug}`,
    body: 'E2E の 1 つ目の版の本文',
  });
  await openNoteEditor(page, editUrl);
  await textbox(page, '本文').fill('E2E の 2 つ目の版の本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E の 2 つ目の版の本文');

  await tabTo(page, page.getByRole('link', { name: '版の一覧' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('版の一覧');

  // 版の一覧は新しい順。最後のリンクが 1 つ目の版
  const oldest = page.getByRole('list').getByRole('link').last();
  await tabTo(page, oldest);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('過去の版');
  await expect(page.getByText('E2E の 1 つ目の版の本文')).toBeVisible();

  const revert = page.getByRole('button', { name: 'この版に戻す' });
  await waitForHydration(revert);
  await tabTo(page, revert);
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(page.getByRole('status')).toHaveText('過去の版の中身を、新しい版として保存しました');
  await expect(textbox(page, '本文')).toHaveValue('E2E の 1 つ目の版の本文');
});

test('版の一覧は、公開の note でだけ公開した版に印を付け、下書きに戻すと印を外す（FR-014）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('published-mark');
  const editUrl = await createNote(page, { slug, title: `E2E の版の印の題 ${slug}` });

  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
  // 公開した後に版を足し、公開した版と最も新しい版を別の版にする
  await openNoteEditor(page, editUrl);
  await textbox(page, '本文').fill('E2E の公開した後の版の本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E の公開した後の版の本文');
  await page.goto(`${editUrl}/revisions`);
  await expect(page.getByRole('listitem').first()).toContainText('・最も新しい版');
  await expect(page.getByRole('listitem').first()).not.toContainText('・公開した版');
  await expect(page.getByRole('listitem').last()).toContainText('・公開した版');

  await openNoteEditor(page, editUrl);
  await submitAndWait(page, '下書きに戻す');
  await expect(page.getByRole('heading', { name: '状態: 下書き' })).toBeVisible();
  // 下書きに戻しても公開した版の記録は残る（FR-014）が、一覧では訪問者に見せている版と読める印を出さない
  await page.goto(`${editUrl}/revisions`);
  await expect(page.getByRole('list')).toContainText('・最も新しい版');
  await expect(page.getByRole('list')).not.toContainText('・公開した版');
});

test('削除した公開の note の版の一覧と過去の版の画面は、訪問者に見せている版と読める言葉を出さない（FR-016）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('deleted-mark');
  const editUrl = await createNote(page, {
    slug,
    title: `E2E の削除した note の印の題 ${slug}`,
    body: 'E2E の 1 つ目の版の本文',
  });
  await openNoteEditor(page, editUrl);
  await textbox(page, '本文').fill('E2E の 2 つ目の版の本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E の 2 つ目の版の本文');
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();

  await page.goto(`${editUrl}/delete`);
  await waitForHydration(page.getByRole('button', { name: '削除する' }));
  await submitAndWait(page, '削除する');
  await expect(page.getByRole('status')).toHaveText('note を削除しました');

  // 削除しても状態は公開のまま（FR-016）だが、訪問者には見えないため、公開した版の印を出さない
  await page.goto(`${editUrl}/revisions`);
  await expect(page.getByRole('list')).toContainText('・最も新しい版');
  await expect(page.getByRole('list')).not.toContainText('・公開した版');

  // 版の一覧は新しい順。最後のリンクが 1 つ目の版
  await page.getByRole('list').getByRole('link').last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('過去の版');
  await expect(page.getByText('E2E の 1 つ目の版の本文')).toBeVisible();
  await expect(page.getByText('訪問者には、公開し直すまで今の公開した版を見せます')).toHaveCount(0);
});

test('過去の版の画面は、公開の note でだけ、戻しても訪問者には今の公開した版を見せると知らせる（FR-009・FR-014）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('revert-notice');
  const editUrl = await createNote(page, {
    slug,
    title: `E2E の戻す説明の題 ${slug}`,
    body: 'E2E の 1 つ目の版の本文',
  });
  await openNoteEditor(page, editUrl);
  await textbox(page, '本文').fill('E2E の 2 つ目の版の本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('E2E の 2 つ目の版の本文');

  const openOldest = async () => {
    await page.goto(`${editUrl}/revisions`);
    // 版の一覧は新しい順。最後のリンクが 1 つ目の版
    await page.getByRole('list').getByRole('link').last().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('過去の版');
  };
  const notice = page.getByText('訪問者には、公開し直すまで今の公開した版を見せます');

  // 下書きの note は訪問者に見せる版を持たないため、訪問者についての説明を出さない
  await openOldest();
  await expect(
    page.getByText('戻すと、この版の題・説明文・本文が新しい版として保存されます'),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);

  await openNoteEditor(page, editUrl);
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('heading', { name: '状態: 公開' })).toBeVisible();
  await openOldest();
  await expect(notice).toBeVisible();
});

test('説明文が空の note で「説明を出さない」を選ぶと、訪問者のページの説明が消える（FR-034）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const slug = uniqueSlug('no-first-paragraph');
  await createNote(page, {
    slug,
    title: `E2E の説明を出さない題 ${slug}`,
    body: 'E2E の最初の段落',
  });
  await submitAndWait(page, '最も新しい版を公開する');
  await expect(page.getByRole('status')).toHaveText('公開しました');

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, `/notes/${slug}`)).toBe(200);
  await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'E2E の最初の段落',
  );

  // 説明文の入力の説明は、空のときの説明が選んだ値で決まることを示す
  await expect(textbox(page, '説明文')).toHaveAccessibleDescription(
    '空にすると、「説明文が空のとき」で選んだ説明を出します',
  );
  const useFirstParagraph = page.getByRole('radio', { name: '本文の最初の段落を説明に使う' });
  const noDescription = page.getByRole('radio', { name: '説明を出さない' });
  await expect(useFirstParagraph).toBeChecked();
  await noDescription.check();
  await submitAndWait(page, '説明文が空のときの説明を変える');
  await expect(page.getByRole('status')).toHaveText('説明文が空のときの説明を変えました');
  await expect(noDescription).toBeChecked();

  expect(await visit(visitor, `/notes/${slug}`)).toBe(200);
  await expect(visitor.getByText('E2E の最初の段落')).toBeVisible();
  await expect(visitor.locator('meta[name="description"]')).toHaveCount(0);
  await expect(visitor.locator('meta[property="og:description"]')).toHaveCount(0);
  await visitor.close();
});
