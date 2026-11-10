import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  chooseSiteOptions,
  fillCareer,
  fillProject,
  registerCareer,
  registerProject,
  registerSkill,
  saveEdit,
  organizationInput,
  submitAndWait,
  textbox,
} from './support/dash';

/**
 * 保存操作をしていない入力が、再読み込みしても残ること（docs/REQUIREMENTS.md の FR-14、
 * specs/001-career-and-project/research.md の R16）。書きかけはブラウザの `localStorage` に持ち、
 * テストごとの context は別の保存先を持つ。
 *
 * 書きかけは、画面の JavaScript が動き始めた時点の入力と、その後の入力を持つ
 * （src/shared/components/draft-retention.tsx）。入力は、書きかけが書き込まれるまで入れ直す。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** 書きかけの名前の一覧。名前は `synsk:draft:<scope>:...` */
const draftKeys = (page: Page) =>
  page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft:')),
  );

/**
 * `fill` で入力し、`scope`（`career`・`project` など）の画面の書きかけが書き込まれるまで入れ直す。
 * 動き始める前の入力は、動き始めるまで書きかけに書き込まれない
 */
const fillUntilDrafted = (page: Page, scope: string, fill: () => Promise<void>) =>
  expect
    .poll(async () => {
      await fill();
      return (await draftKeys(page)).some((key) => key.startsWith(`synsk:draft:${scope}:`));
    })
    .toBe(true);

test('職歴の登録の画面で、保存せずに再読み込みしても入力が残り、登録すると消える', async ({
  page,
  context,
}) => {
  const role = `E2E 書きかけの肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, {
      organizationName: 'E2E 書きかけの組織',
      organizationNameMasked: 'E2E 書きかけの秘匿化した組織名',
      role,
      startedOn: '2020-04-01',
      description: '1 行目\n2 行目',
      isMasked: false,
      onSite: true,
    }),
  );
  await page.reload();

  await expect(organizationInput(page)).toHaveValue('E2E 書きかけの組織');
  await expect(textbox(page, '肩書')).toHaveValue(role);
  await expect(textbox(page, '始まりの日')).toHaveValue('2020-04-01');
  await expect(textbox(page, '本文')).toHaveValue('1 行目\n2 行目');
  await expect(
    page.getByRole('radio', { name: '秘匿化しない（実際の値で出す）', exact: true }),
  ).toBeChecked();
  await expect(page.getByRole('radio', { name: 'サイトに載せる', exact: true })).toBeChecked();

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect.poll(() => draftKeys(page)).toEqual([]);
  await page.goto('/dash/careers/new');
  await expect(textbox(page, '肩書')).toHaveValue('');
});

test('職歴の登録で項目の不備があっても、再読み込みすると送った入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  // 組織名を空のまま送ると、項目の不備で止まる
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, { role: 'E2E 不備のある書きかけ', startedOn: '2020-04-01' }),
  );
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '入力を確かめてください' })).toBeVisible();
  await expect.poll(() => draftKeys(page)).toEqual(['synsk:draft:career:new']);
  await page.reload();
  await expect(textbox(page, '肩書')).toHaveValue('E2E 不備のある書きかけ');
});

test('職歴の登録の送信が応答を返さずに失敗しても、再読み込みすると入力が残る', async ({
  page,
  context,
}) => {
  const role = `E2E 送れなかった肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, {
      organizationName: 'E2E 送れなかった組織',
      organizationNameMasked: 'E2E 送れなかった秘匿化した組織名',
      role,
      startedOn: '2020-04-01',
    }),
  );
  // Server Action の送信を切る。失敗の結果は来ない
  await page.route('**/dash/careers/new', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  const aborted = page.waitForEvent('requestfailed', (req) => req.method() === 'POST');
  await page.getByRole('button', { name: '登録する' }).click();
  await aborted;
  await page.unroute('**/dash/careers/new');
  await page.goto('/dash/careers/new');
  await expect(textbox(page, '肩書')).toHaveValue(role);
});

test('職歴の編集の画面で、保存せずに再読み込みしても入力が残り、保存すると消える', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 書きかけの編集の組織',
    organizationNameMasked: 'E2E 書きかけの編集の秘匿化した組織名',
    role: 'E2E 保存した肩書',
  });
  await page.goto(editUrl);
  await fillUntilDrafted(page, 'career', () =>
    textbox(page, '肩書').fill('E2E 保存していない肩書'),
  );
  await page.reload();
  await expect(textbox(page, '肩書')).toHaveValue('E2E 保存していない肩書');

  const openedUpdatedAt = page.locator('input[name="openedUpdatedAt"]');
  const updatedAtBeforeSave = await openedUpdatedAt.inputValue();
  await saveEdit(page);
  await expect(openedUpdatedAt).not.toHaveValue(updatedAtBeforeSave);
  await expect.poll(() => draftKeys(page)).toEqual([]);
  await page.goto(editUrl);
  await expect(textbox(page, '肩書')).toHaveValue('E2E 保存していない肩書');
});

test('職歴を別の画面で先に保存された後に開き直すと、前の更新日時の書きかけを知らせ、戻せる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 前の書きかけの組織',
    organizationNameMasked: 'E2E 前の書きかけの秘匿化した組織名',
    role: 'E2E 前の書きかけの保存した肩書',
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await textbox(other, '肩書').fill('E2E 先に保存した肩書');
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, 'career', () =>
    textbox(page, '肩書').fill('E2E 前の更新日時の書きかけ'),
  );
  await page.reload();

  // 自動では戻さない（specs/001-career-and-project/spec.md の FR-042）
  const notice = page.getByRole('region', { name: '前の版の書きかけ' });
  await expect(notice).toContainText('この画面を開く前の版から書いた書きかけ');
  await expect(textbox(page, '肩書')).toHaveValue('E2E 先に保存した肩書');
  await notice.getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(textbox(page, '肩書')).toHaveValue('E2E 前の更新日時の書きかけ');
  await expect(notice).toContainText('書きかけで変えた項目を戻しました');
});

test('前の更新日時の書きかけを戻すと、書きかけで変えた項目だけが入り、先に保存した項目は残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 部分の書きかけの組織',
    organizationNameMasked: 'E2E 部分の書きかけの秘匿化した組織名',
    role: 'E2E 部分の書きかけの保存した肩書',
    onSite: true,
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await organizationInput(other).fill('E2E 先に保存した組織名');
  await chooseSiteOptions(other, { onSite: false });
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, 'career', () =>
    textbox(page, '肩書').fill('E2E 書きかけで変えた肩書'),
  );
  await page.reload();

  const notice = page.getByRole('region', { name: '前の版の書きかけ' });
  await notice.getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(notice).toContainText('書きかけで変えた項目を戻しました');
  await expect(textbox(page, '肩書')).toHaveValue('E2E 書きかけで変えた肩書');
  // 書きかけで触っていない項目は、先に保存した値のまま（specs/001-career-and-project/spec.md の FR-042）
  await expect(organizationInput(page)).toHaveValue('E2E 先に保存した組織名');
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();
  await expect(textbox(page, '秘匿化した組織名')).toHaveValue(
    'E2E 部分の書きかけの秘匿化した組織名',
  );
});

test('保存が先の保存とぶつかって拒まれた後に開き直して戻すと、送った書きかけで変えた項目だけが入る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E ぶつかる書きかけの組織',
    organizationNameMasked: 'E2E ぶつかる書きかけの秘匿化した組織名',
    role: 'E2E ぶつかる書きかけの保存した肩書',
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await organizationInput(other).fill('E2E ぶつかる前に先に保存した組織名');
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, 'career', () =>
    textbox(page, '肩書').fill('E2E ぶつかって拒まれた肩書'),
  );
  // 拒まれた結果は送った値を持ち、入力の初めの値（`defaultValue`）が送った値に変わる
  await submitAndWait(page, '保存する');
  await expect(page.getByText('開いた後に別の画面で書き換えられていました')).toBeVisible();
  await page.reload();

  const notice = page.getByRole('region', { name: '前の版の書きかけ' });
  await notice.getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(notice).toContainText('書きかけで変えた項目を戻しました');
  await expect(textbox(page, '肩書')).toHaveValue('E2E ぶつかって拒まれた肩書');
  await expect(organizationInput(page)).toHaveValue('E2E ぶつかる前に先に保存した組織名');
});

test('書いた画面が開いたときの値を持たない形式の前の版の書きかけは、戻すとすべての項目が入る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 古い形式の書きかけの組織',
    organizationNameMasked: 'E2E 古い形式の書きかけの秘匿化した組織名',
    role: 'E2E 古い形式の書きかけの保存した肩書',
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await organizationInput(other).fill('E2E 古い形式の後に先に保存した組織名');
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, 'career', () =>
    textbox(page, '肩書').fill('E2E 古い形式の書きかけの肩書'),
  );
  // `base` を持たない形式（{ writtenAt, values }）に書き換える
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith('synsk:draft:career:')) continue;
      const { writtenAt, values } = JSON.parse(window.localStorage.getItem(key) ?? '{}');
      window.localStorage.setItem(key, JSON.stringify({ writtenAt, values }));
    }
  });
  await page.reload();

  const notice = page.getByRole('region', { name: '前の版の書きかけ' });
  await notice.getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(notice).toContainText('書きかけを戻しました');
  await expect(notice).not.toContainText('書きかけで変えた項目');
  await expect(textbox(page, '肩書')).toHaveValue('E2E 古い形式の書きかけの肩書');
  // 変えた項目が分からないので、書きかけを書いた版の組織名も入る
  await expect(organizationInput(page)).toHaveValue('E2E 古い形式の書きかけの組織');
});

test('前の更新日時の書きかけが、書いた画面が開いたときの値から何も変えていなければ、知らせない', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 変えない書きかけの組織',
    organizationNameMasked: 'E2E 変えない書きかけの秘匿化した組織名',
    role: 'E2E 変えない書きかけの保存した肩書',
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await organizationInput(other).fill('E2E 変えない書きかけの後に先に保存した組織名');
  await saveEdit(other);
  await other.close();
  // 打ってから元に戻す。書きかけは、開いたときと同じ値を持つ
  await fillUntilDrafted(page, 'career', async () => {
    await textbox(page, '肩書').fill('E2E 一度だけ打った肩書');
    await textbox(page, '肩書').fill('E2E 変えない書きかけの保存した肩書');
  });
  await page.reload();

  await expect(organizationInput(page)).toHaveValue('E2E 変えない書きかけの後に先に保存した組織名');
  await expect(page.getByRole('region', { name: '前の版の書きかけ' })).toHaveCount(0);
});

test('前の更新日時の書きかけでチェックを足した項目を戻すと、先に保存した画面が足したチェックも残る', async ({
  page,
  context,
}) => {
  const id = crypto.randomUUID();
  const kept = `E2E 初めから選んだスキル ${id}`;
  const drafted = `E2E 書きかけで足すスキル ${id}`;
  const saved = `E2E 先に保存して足すスキル ${id}`;
  await actAsAuthor(context);
  for (const skill of [kept, drafted, saved]) await registerSkill(page, skill);
  const { editUrl } = await registerProject(page, {
    organizationName: 'E2E 足す書きかけの実績の組織',
    organizationNameMasked: 'E2E 足す書きかけの実績の秘匿化した組織名',
    title: 'E2E 足す書きかけの題',
    skills: [kept],
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await other.getByRole('checkbox', { name: saved, exact: true }).check();
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, 'project', () =>
    page.getByRole('checkbox', { name: drafted, exact: true }).check(),
  );
  await page.reload();

  const notice = page.getByRole('region', { name: '前の版の書きかけ' });
  await notice.getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(notice).toContainText('書きかけで変えた項目を戻しました');
  // 同じ名前のチェックボックスは、値ごとに、書きかけで変えたものだけを戻す（FR-042）
  await expect(page.getByRole('checkbox', { name: drafted, exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: saved, exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: kept, exact: true })).toBeChecked();
});

test('前の更新日時の書きかけでチェックを外した項目を戻すと、外したまま入り、先に保存した項目は残る', async ({
  page,
  context,
}) => {
  const skill = `E2E 書きかけで外すスキル ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerSkill(page, skill);
  const { editUrl } = await registerProject(page, {
    organizationName: 'E2E 外す書きかけの実績の組織',
    organizationNameMasked: 'E2E 外す書きかけの実績の秘匿化した組織名',
    title: 'E2E 外す書きかけの保存した題',
    skills: [skill],
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await textbox(other, '題').fill('E2E 先に保存した題');
  await saveEdit(other);
  await other.close();
  await fillUntilDrafted(page, 'project', () =>
    page.getByRole('checkbox', { name: skill, exact: true }).uncheck(),
  );
  await page.reload();
  await expect(page.getByRole('checkbox', { name: skill, exact: true })).toBeChecked();

  const notice = page.getByRole('region', { name: '前の版の書きかけ' });
  await notice.getByRole('button', { name: '書きかけを戻す' }).click();
  await expect(notice).toContainText('書きかけで変えた項目を戻しました');
  // 外したチェックボックスは FormData に名前が残らない。名前が無いことを、外したと読む
  await expect(page.getByRole('checkbox', { name: skill, exact: true })).not.toBeChecked();
  await expect(textbox(page, '題')).toHaveValue('E2E 先に保存した題');
});

test('実績の登録の画面で、選んだスキルと種類が再読み込みしても残る', async ({ page, context }) => {
  const skill = `E2E 書きかけのスキル ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerSkill(page, skill);
  await page.goto('/dash/projects/new');
  await fillUntilDrafted(page, 'project', () =>
    fillProject(page, {
      organizationName: 'E2E 書きかけの実績の組織',
      kind: '登壇',
      title: 'E2E 書きかけの実績',
      skills: [skill],
    }),
  );
  await page.reload();
  await expect(textbox(page, '題')).toHaveValue('E2E 書きかけの実績');
  await expect(page.getByRole('combobox', { name: '種類' })).toHaveValue('talk');
  await expect(page.getByRole('checkbox', { name: skill, exact: true })).toBeChecked();
});

test('学歴とスキルの登録の画面で、保存せずに再読み込みしても入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/educations/new');
  await fillUntilDrafted(page, 'education', () => textbox(page, '学校').fill('E2E 書きかけの学校'));
  await page.reload();
  await expect(textbox(page, '学校')).toHaveValue('E2E 書きかけの学校');

  await page.goto('/dash/skills/new');
  await fillUntilDrafted(page, 'skill', () =>
    textbox(page, '名前').fill('E2E 書きかけのスキルの名前'),
  );
  await page.reload();
  await expect(textbox(page, '名前')).toHaveValue('E2E 書きかけのスキルの名前');
});

test('組織の編集の画面で、保存せずに再読み込みしても入力が残る', async ({ page, context }) => {
  const name = `E2E 書きかけの組織の画面 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: name,
    organizationNameMasked: 'E2E 書きかけの組織の画面の秘匿化した組織名',
    role: 'E2E 書きかけの組織の画面の肩書',
  });
  await page.goto('/dash/organizations');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('組織を編集する');
  await fillUntilDrafted(page, 'organization', () =>
    textbox(page, '秘匿化した組織名').fill('E2E 保存していない秘匿化した組織名'),
  );
  await page.reload();
  await expect(textbox(page, '秘匿化した組織名')).toHaveValue('E2E 保存していない秘匿化した組織名');
});

/*
 * 続けて保存しても、保存できた書きかけが残らないこと。2 回目の保存は 1 回目と同じ `?saved=1` の
 * 画面へ移る（003 の note の画面で見つかった誤り。PR #231 のレビュー）
 */

/** 送った書きかけの名前を持つ場所（src/shared/components/draft-retention.tsx の `SENT_KEY`） */
const sentKey = (page: Page) =>
  page.evaluate(() => window.localStorage.getItem('synsk:draft-sent'));

/** `fill` で入れて保存する。応答を待つ */
const fillAndSave = async (page: Page, scope: string, fill: () => Promise<void>) => {
  await fillUntilDrafted(page, scope, fill);
  // 編集の画面のフォームは、保存した行の更新日時ごとに置き直される。置き直される前に次の入力を
  // 入れると、置き直しで消える。送る前のフォームに印を付け、印の無いフォームに替わるまで待つ。
  // 前の画面が隠れて DOM に残ることがあるため、見えているフォームだけを調べる。編集の入力の
  // フォームは画面の最初のフォームで、後に画像のフォームが続く
  await page
    .locator('main form')
    .filter({ visible: true })
    .first()
    .evaluate((form) => form.setAttribute('data-e2e-stale', ''));
  await submitAndWait(page, '保存する');
  await expect(page.locator('main form[data-e2e-stale]').filter({ visible: true })).toHaveCount(0);
};

const expectNoDraftLeft = async (page: Page) => {
  await expect.poll(() => draftKeys(page)).toEqual([]);
  expect(await sentKey(page)).toBeNull();
};

/**
 * 保存した前の版の書きかけを、残った書きかけとして知らせない。知らせは画面の JavaScript が
 * 書きかけを探した後に出るので、探し終えた印を待ってから数える
 */
const expectNoStaleNotice = async (page: Page) => {
  await expect(
    page.locator('main form[data-draft-stale-checked]').filter({ visible: true }),
  ).toHaveCount(1);
  await expect(page.getByRole('region', { name: '前の版の書きかけ' })).toHaveCount(0);
};

test('職歴の編集の画面で続けて 2 回保存しても、書きかけが残らない', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: 'E2E 続けて保存する職歴の組織',
    organizationNameMasked: 'E2E 続けて保存する職歴の秘匿化した組織名',
    role: 'E2E 続けて保存する肩書 0',
  });
  for (const n of [1, 2]) {
    await fillAndSave(page, 'career', () =>
      textbox(page, '肩書').fill(`E2E 続けて保存する肩書 ${n}`),
    );
    await expect(textbox(page, '肩書')).toHaveValue(`E2E 続けて保存する肩書 ${n}`);
  }
  await expectNoDraftLeft(page);
  await expectNoStaleNotice(page);
});

test('実績の編集の画面で続けて 2 回保存しても、書きかけが残らない', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 続けて保存する実績の組織',
    organizationNameMasked: 'E2E 続けて保存する実績の秘匿化した組織名',
    title: 'E2E 続けて保存する題 0',
  });
  for (const n of [1, 2]) {
    await fillAndSave(page, 'project', () => textbox(page, '題').fill(`E2E 続けて保存する題 ${n}`));
    await expect(textbox(page, '題')).toHaveValue(`E2E 続けて保存する題 ${n}`);
  }
  await expectNoDraftLeft(page);
  await expectNoStaleNotice(page);
});

test('組織の編集の画面で続けて 2 回保存しても、書きかけが残らない', async ({ page, context }) => {
  const name = `E2E 続けて保存する組織 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: name,
    organizationNameMasked: 'E2E 続けて保存する組織の秘匿化した組織名',
    role: 'E2E 続けて保存する組織の肩書',
  });
  await page.goto('/dash/organizations');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('組織を編集する');
  for (const n of [1, 2]) {
    await fillAndSave(page, 'organization', () =>
      textbox(page, '秘匿化した組織名').fill(`E2E 続けて保存する秘匿化した組織名 ${n}`),
    );
    await expect(textbox(page, '秘匿化した組織名')).toHaveValue(
      `E2E 続けて保存する秘匿化した組織名 ${n}`,
    );
  }
  await expectNoDraftLeft(page);
  await expectNoStaleNotice(page);
});

test('スキルと学歴を登録してから編集しても、書きかけが残らない', async ({ page, context }) => {
  const skill = `E2E-Draft-Skill-${crypto.randomUUID()}`;
  const school = `E2E 続けて保存する学校 ${crypto.randomUUID()}`;
  await actAsAuthor(context);

  await page.goto('/dash/skills/new');
  await fillUntilDrafted(page, 'skill', () => textbox(page, '名前').fill(skill));
  await submitAndWait(page, '登録する');
  await page.getByRole('link', { name: skill, exact: true }).click();
  await fillAndSave(page, 'skill', () => textbox(page, '名前').fill(`${skill}-2`));
  await expect(page.getByRole('link', { name: `${skill}-2`, exact: true })).toBeVisible();
  await expectNoDraftLeft(page);

  await page.goto('/dash/educations/new');
  await fillUntilDrafted(page, 'education', async () => {
    await textbox(page, '学校').fill(school);
    await textbox(page, '始まりの日').fill('2014-04-01');
  });
  await submitAndWait(page, '登録する');
  await page.getByRole('link', { name: school }).click();
  await fillAndSave(page, 'education', () => textbox(page, '学部').fill('E2E 続けて保存する学部'));
  await expect(page.getByRole('link', { name: `${school}・E2E 続けて保存する学部` })).toBeVisible();
  await expectNoDraftLeft(page);
});

test('送信が応答を返さずに失敗した後、別の画面の保存の知らせへ戻っても、書きかけが残る', async ({
  page,
  context,
}) => {
  const skill = `E2E-Back-Skill-${crypto.randomUUID()}`;
  const role = `E2E 戻った後の肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  // スキルを登録し、保存の知らせのある一覧の画面を履歴に残す
  await page.goto('/dash/skills/new');
  await fillUntilDrafted(page, 'skill', () => textbox(page, '名前').fill(skill));
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await page.goto('/dash/careers/new');
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, {
      organizationName: 'E2E 戻った後の組織',
      organizationNameMasked: 'E2E 戻った後の秘匿化した組織名',
      role,
      startedOn: '2020-04-01',
    }),
  );
  // Server Action の送信を切る。失敗の結果は来ない
  await page.route('**/dash/careers/new', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  const aborted = page.waitForEvent('requestfailed', (req) => req.method() === 'POST');
  await page.getByRole('button', { name: '登録する' }).click();
  await aborted;
  await page.unroute('**/dash/careers/new');

  // ブラウザの「戻る」で、スキルの保存の知らせのある画面へ戻る
  await page.goBack();
  await expect(page).toHaveURL(/\/dash\/skills\?saved=1$/);
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect.poll(() => draftKeys(page)).toContain('synsk:draft:career:new');

  await page.goto('/dash/careers/new');
  await expect(textbox(page, '肩書')).toHaveValue(role);
});

/*
 * JavaScript が動く前（hydration の前）に打った本文が、hydration の後も残ること。react-dom の
 * hydration は、初めの値を持つ `<textarea>` の値を初めの値に戻す（`initTextarea`）
 */

/**
 * 画面のスクリプトの読み込みを止める。返した関数を呼ぶと、止めていた読み込みを流し、それ以降は
 * 止めない。止めている要求が残るうちに経路の登録を外すと、Playwright が二重の処理として止まる
 */
const holdScripts = async (page: Page) => {
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

/** フォームが hydration を終えるまで待つ。React は hydration した要素にフィバーの印を付ける */
const waitForHydration = (page: Page) =>
  page.waitForFunction(() => {
    const form = document.querySelector('main form');
    return form !== null && Object.keys(form).some((key) => key.startsWith('__reactFiber'));
  });

test('JavaScript が動く前に本文を打っても、動いた後に本文が残り、保存で送られる', async ({
  page,
  context,
}) => {
  const typed = `E2E 動く前に打った本文 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 動く前に打つ組織',
    organizationNameMasked: 'E2E 動く前に打つ秘匿化した組織名',
    role: 'E2E 動く前に打つ肩書',
    description: 'E2E 保存した本文',
  });

  const release = await holdScripts(page);
  await page.goto(editUrl, { waitUntil: 'commit' });
  await textbox(page, '本文').fill(typed);
  await release();
  await waitForHydration(page);
  await expect(textbox(page, '本文')).toHaveValue(typed);

  await saveEdit(page);
  await page.goto(editUrl);
  await expect(textbox(page, '本文')).toHaveValue(typed);
});

test('JavaScript が動く前に本文を打ち、保存せずに再読み込みしても、本文が残る', async ({
  page,
  context,
}) => {
  const typed = `E2E 動く前に打って再読み込みした本文 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 動く前に打って再読み込みする組織',
    organizationNameMasked: 'E2E 動く前に打って再読み込みする秘匿化した組織名',
    role: 'E2E 動く前に打って再読み込みする肩書',
    description: 'E2E 保存した本文',
  });

  const release = await holdScripts(page);
  await page.goto(editUrl, { waitUntil: 'commit' });
  await textbox(page, '本文').fill(typed);
  await release();
  await waitForHydration(page);
  await expect(textbox(page, '本文')).toHaveValue(typed);

  await page.reload();
  await expect(textbox(page, '本文')).toHaveValue(typed);
});

test('保存の知らせの画面で JavaScript が動く前に本文を打ち、保存せずに再読み込みしても、本文が残る', async ({
  page,
  context,
}) => {
  const typed = `E2E 知らせの画面で動く前に打った本文 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 知らせの画面で動く前に打つ組織',
    organizationNameMasked: 'E2E 知らせの画面で動く前に打つ秘匿化した組織名',
    role: 'E2E 知らせの画面で動く前に打つ肩書',
    description: 'E2E 保存した本文',
  });

  const release = await holdScripts(page);
  await page.goto(`${editUrl}?saved=1`, { waitUntil: 'commit' });
  await textbox(page, '本文').fill(typed);
  await release();
  await waitForHydration(page);
  await expect(textbox(page, '本文')).toHaveValue(typed);

  await page.reload();
  await expect(textbox(page, '本文')).toHaveValue(typed);
});

test('JavaScript が動く前に打って送らずに離れ、60 秒を過ぎてから保存の知らせの画面を開いても、書きかけが残る', async ({
  page,
  context,
}) => {
  const typed = `E2E 送らずに離れた本文 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 送らずに離れる組織',
    organizationNameMasked: 'E2E 送らずに離れる秘匿化した組織名',
    role: 'E2E 送らずに離れる肩書',
    description: 'E2E 保存した本文',
  });

  const release = await holdScripts(page);
  await page.goto(editUrl, { waitUntil: 'commit' });
  await textbox(page, '本文').fill(typed);
  await release();
  await waitForHydration(page);
  await expect(textbox(page, '本文')).toHaveValue(typed);

  // 動き始めた時点で付けた印を、60 秒より前に付けたことにする
  await page.evaluate(() =>
    window.localStorage.setItem('synsk:draft-sent-before-hydration', String(Date.now() - 61_000)),
  );
  await page.goto(`${editUrl}?saved=1`);
  await waitForHydration(page);
  await page.goto(editUrl);
  await expect(textbox(page, '本文')).toHaveValue(typed);
});
