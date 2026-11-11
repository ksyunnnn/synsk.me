import { describe, expect, it } from 'vitest';
import { routes } from '@/shared/routes';

/**
 * 画面の経路の定数（`src/shared/routes.ts`）が、`src/app/` のページの経路と同じ値を返すかを
 * 確かめる。値を変えると、リンク・`redirect()`・`src/proxy.ts` の rewrite の行き先が変わる
 */

describe('訪問者の画面の経路', () => {
  it('静的な経路は定数で持つ', () => {
    expect(routes.home).toBe('/');
    expect(routes.top).toBe('/top-draft');
    expect(routes.about).toBe('/about');
    expect(routes.contact).toBe('/contact');
    expect(routes.resumes).toBe('/resume');
    expect(routes.lab).toBe('/lab');
  });

  it('識別子を含む経路は関数で作る', () => {
    expect(routes.project('a-1')).toBe('/projects/a-1');
    expect(routes.projectMissing('a-1')).toBe('/projects/a-1/missing');
    expect(routes.projectMedia('a-1', 'k')).toBe('/projects/a-1/media/k');
    expect(routes.lifeEvent('a-1')).toBe('/life-events/a-1');
    expect(routes.lifeEventMissing('a-1')).toBe('/life-events/a-1/missing');
    expect(routes.lifeEventMedia('a-1', 'k')).toBe('/life-events/a-1/media/k');
    expect(routes.resume('a-1')).toBe('/resume/a-1');
    expect(routes.resumeMissing('a-1')).toBe('/resume/a-1/missing');
    expect(routes.note('a-1')).toBe('/notes/a-1');
    expect(routes.noteMissing('a-1')).toBe('/notes/a-1/missing');
    expect(routes.noteMedia('a-1')).toBe('/notes/a-1/media');
    expect(routes.labPage('delay-visuals', 'v4.2', 'rebuild')).toBe(
      '/lab/delay-visuals/v4.2/rebuild',
    );
  });
});

describe('管理画面の経路', () => {
  it('入口と 403 の画面', () => {
    expect(routes.dash.index).toBe('/dash');
    expect(routes.dash.forbidden).toBe('/dash/forbidden');
  });

  it.each([
    ['careers', routes.dash.careers],
    ['projects', routes.dash.projects],
    ['educations', routes.dash.educations],
    ['skills', routes.dash.skills],
    ['organizations', routes.dash.organizations],
    ['resumes', routes.dash.resumes],
    ['notes', routes.dash.notes],
    ['life-events', routes.dash.lifeEvents],
    ['activities', routes.dash.activities],
  ])('%s の一覧・作成・行・削除・行が無いとき', (collection, paths) => {
    expect(paths.list).toBe(`/dash/${collection}`);
    expect(paths.new).toBe(`/dash/${collection}/new`);
    expect(paths.row('u1')).toBe(`/dash/${collection}/u1`);
    expect(paths.delete('u1')).toBe(`/dash/${collection}/u1/delete`);
    expect(paths.missing('u1')).toBe(`/dash/${collection}/u1/missing`);
  });

  it('コレクションの名前から行が無いときの経路を作る', () => {
    expect(routes.dash.rowMissing('skills', 'u1')).toBe('/dash/skills/u1/missing');
  });

  it('職務経歴書の下の経路', () => {
    const r = routes.dash.resumes;
    expect(r.preview('u1')).toBe('/dash/resumes/u1/preview');
    expect(r.skills('u1')).toBe('/dash/resumes/u1/skills');
    expect(r.entryNew('u1', 'careers')).toBe('/dash/resumes/u1/careers/new');
    expect(r.entry('u1', 'projects', 'r1')).toBe('/dash/resumes/u1/projects/r1');
    expect(r.entryMissing('u1', 'educations', 'r1')).toBe('/dash/resumes/u1/educations/r1/missing');
  });

  it('note の下の経路', () => {
    const n = routes.dash.notes;
    expect(n.preview('u1')).toBe('/dash/notes/u1/preview');
    expect(n.previewMedia('u1')).toBe('/dash/notes/u1/preview/media');
    expect(n.revisions('u1')).toBe('/dash/notes/u1/revisions');
    expect(n.revision('u1', 'r1')).toBe('/dash/notes/u1/revisions/r1');
    expect(n.revisionMissing('u1', 'r1')).toBe('/dash/notes/u1/revisions/r1/missing');
  });
});
