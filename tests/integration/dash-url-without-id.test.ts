import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { sendForm } from './support/send';
import {
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
  insertSkill,
} from '../support/career-and-project-rows';
import {
  insertResume,
  insertResumeCareer,
  insertResumeEducation,
  insertResumeProject,
} from '../support/resume-rows';
import { insertExternalActivity, insertLifeEvent } from '../support/activity-rows';

/**
 * 管理画面の URL に主キーが出ないこと（ADR-0048 の「主キーは URL に出さない」、
 * specs/001-career-and-project/research.md の R17）。
 *
 * オーナーとして `/dash` から管理画面のリンクを辿り、開いたすべての画面で次を確かめる。
 * - `/dash` へのリンクの経路に、数字だけの区切りが無い
 * - 隠しフィールドに、数字だけの値が無い（React が描く `$ACTION_` の入力は除く）
 * 保存の後の redirect 先の経路にも、数字だけの区切りが無いことを確かめる
 */

let ctx: TestServer;

/** 辿る画面の数の上限。リンクの作り方を誤って画面が増え続けても、検査を止める */
const MAX_PAGES = 200;

const DIGITS_ONLY = /^\d+$/;

const decodeEntities = (value: string) =>
  value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'");

const dashLinksOf = (html: string) =>
  [...html.matchAll(/href="([^"]*)"/g)]
    .map(([, href]) => decodeEntities(href))
    .filter((href) => href === '/dash' || href.startsWith('/dash/'));

const digitSegmentsOf = (href: string) =>
  new URL(href, 'https://synsk.test').pathname
    .split('/')
    .filter((segment) => DIGITS_ONLY.test(segment));

const digitHiddenInputsOf = (html: string) =>
  [...html.matchAll(/<input\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /type="hidden"/.test(tag))
    .map((tag) => ({
      name: tag.match(/name="([^"]*)"/)?.[1] ?? '',
      value: decodeEntities(tag.match(/value="([^"]*)"/)?.[1] ?? ''),
    }))
    .filter(({ name, value }) => !name.startsWith('$ACTION') && DIGITS_ONLY.test(value));

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const organizationId = await insertOrganization(db);
      const careerId = await insertCareer(db, { organizationId });
      const projectId = await insertProject(db, { organizationId, slug: 'dash-url-check' });
      const educationId = await insertEducation(db);
      await insertSkill(db, { name: 'Go' });
      const resume = await insertResume(db);
      await insertResumeCareer(db, { resumeId: resume.id, careerId });
      await insertResumeProject(db, { resumeId: resume.id, projectId, skills: ['Go'] });
      await insertResumeEducation(db, { resumeId: resume.id, educationId });
      await insertLifeEvent(db);
      await insertExternalActivity(db, { source: 'unlisted' });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('管理画面のリンクと隠しフィールドに主キーが出ない', () => {
  it('/dash から辿れるすべての画面', async () => {
    const visited = new Set<string>();
    const queue = ['/dash'];
    const found: string[] = [];

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const path = queue.shift()!;
      if (visited.has(path)) continue;
      visited.add(path);

      const res = await ctx.server.fetch(path, {
        headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
      });
      const html = await res.text();
      expect(res.status, path).toBe(200);

      for (const href of dashLinksOf(html)) {
        if (digitSegmentsOf(href).length > 0) found.push(`${path} のリンク ${href}`);
        const next = new URL(href, 'https://synsk.test').pathname;
        if (!visited.has(next)) queue.push(next);
      }
      for (const { name, value } of digitHiddenInputsOf(html)) {
        found.push(`${path} の隠しフィールド ${name}=${value}`);
      }
    }

    expect(found).toEqual([]);
    // 行を 1 つずつ開く画面まで辿れていること。辿れていなければ、上の確かめが空振りする
    for (const pattern of [
      /^\/dash\/organizations\/[0-9a-f]{32}$/,
      /^\/dash\/careers\/[0-9a-f]{32}\/delete$/,
      /^\/dash\/projects\/[0-9a-f]{32}\/delete$/,
      /^\/dash\/educations\/[0-9a-f]{32}\/delete$/,
      /^\/dash\/skills\/[0-9a-f]{32}\/delete$/,
      /^\/dash\/resumes\/[0-9a-f]{32}\/delete$/,
      /^\/dash\/resumes\/[0-9a-f]{32}\/careers\/[0-9a-f]{32}$/,
      /^\/dash\/resumes\/[0-9a-f]{32}\/projects\/[0-9a-f]{32}$/,
      /^\/dash\/resumes\/[0-9a-f]{32}\/educations\/[0-9a-f]{32}$/,
      /^\/dash\/activities\/[0-9a-f]{32}\/delete$/,
      /^\/dash\/life-events\/[0-9a-f]{32}\/delete$/,
    ]) {
      expect(
        [...visited].some((path) => pattern.test(path)),
        String(pattern),
      ).toBe(true);
    }
  });
});

describe('保存の後の redirect 先に主キーが出ない', () => {
  it('職歴を登録すると、uid の編集の画面へ移る', async () => {
    const res = await sendForm(ctx, {
      how: 'submit',
      formPath: '/dash/careers/new',
      asAuthor: true,
      values: {
        organizationName: '作り物株式会社',
        organizationNameMasked: 'ある会社',
        role: 'redirect 先を確かめる作り物の肩書',
        isMasked: '1',
        status: 'draft',
        startedOn: '2020-04-01',
        endedOn: '',
        description: '',
        url: '',
      },
    });
    expect(res.status).toBe(303);
    const location = res.headers.get('location') ?? '';
    expect(new URL(location, 'https://synsk.test').pathname).toMatch(
      /^\/dash\/careers\/[0-9a-f]{32}$/,
    );
    expect(digitSegmentsOf(location)).toEqual([]);
  });
});
