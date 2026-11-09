import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  fillCareer,
  fillProject,
  registerCareer,
  registerProject,
  registerSkill,
  saveEdit,
  submitAndWait,
  textbox,
} from './support/dash';

/**
 * 保存操作をしていない入力が、再読み込みしても残ること（docs/REQUIREMENTS.md の FR-14、
 * specs/001-career-and-project/research.md の R16）。書きかけはブラウザの `localStorage` に持ち、
 * テストごとの context は別の保存先を持つ。
 *
 * 書きかけは、画面の JavaScript が動き始めた後の入力だけを持つ（src/shared/components/draft-retention.tsx）。
 * 入力は、書きかけが書き込まれるまで入れ直す。
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
 * JavaScript が動く前の入力は、書きかけに書き込まれない
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

  await expect(textbox(page, '組織名')).toHaveValue('E2E 書きかけの組織');
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
  // 前の画面が隠れて DOM に残ることがあるため、見えているフォームだけを調べる
  await page
    .locator('main form')
    .filter({ visible: true })
    .evaluate((form) => form.setAttribute('data-e2e-stale', ''));
  await submitAndWait(page, '保存する');
  await expect(page.locator('main form[data-e2e-stale]').filter({ visible: true })).toHaveCount(0);
};

const expectNoDraftLeft = async (page: Page) => {
  await expect.poll(() => draftKeys(page)).toEqual([]);
  expect(await sentKey(page)).toBeNull();
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
