import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';
import { deleteNoteRows, insertNote, insertNoteMedia } from '../support/note-rows';

/**
 * `NoteRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/003-note/spec.md の FR-001〜FR-017・FR-020・FR-031・FR-032、research.md の R4・R5・R13）。
 * 画像を配る条件は tests/workers/note-media.test.ts が持つ
 */

const notes = createD1NoteRepository(env.DB);

const T1 = '2026-11-02T00:00:00.000Z';
const T2 = '2026-11-03T00:00:00.000Z';

const content = (title: string, body = `${title}の本文`) => ({ title, description: null, body });

const create = async (slug = 'fake-note', title = '1 つ目の題') => {
  const result = await notes.create(slug, content(title));
  if (!result.ok) throw new Error(`作れなかった: ${result.reason}`);
  return result.id;
};

const readNote = (id: number) =>
  env.DB.prepare('SELECT * FROM note WHERE id = ?').bind(id).first<Record<string, unknown>>();

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteNoteRows(env.DB);
});

describe('作る（FR-001・FR-002）', () => {
  it('作った note は下書きで、版を 1 つ持ち、uid を持つ', async () => {
    const id = await create();
    const note = await notes.findForEdit(id);
    expect(note).toMatchObject({
      status: 'draft',
      isDeleted: false,
      publishedAt: null,
      publishedRevisionNumber: null,
      latest: { number: 1, title: '1 つ目の題' },
    });
    expect(note?.uid).toMatch(/^[0-9a-f]{32}$/);
  });

  it('削除した note の識別子でも、別の note を作れない（User Story 2 の 4）', async () => {
    const id = await create('sample-note');
    await notes.delete(id, T1);
    expect(await notes.create('sample-note', content('別の note'))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });
});

describe('保存と版（FR-006〜FR-008・FR-020・FR-021・SC-003）', () => {
  it('保存のたびに版が増え、過去の版が保存したときのまま読める', async () => {
    const id = await create();
    expect(await notes.save(id, 'fake-note', content('2 つ目の題'), 1)).toEqual({
      ok: true,
      revision: 2,
    });
    expect(await notes.save(id, 'fake-note', content('3 つ目の題'), 2)).toEqual({
      ok: true,
      revision: 3,
    });
    const revisions = await notes.listRevisions(id);
    expect(revisions.map((r) => [r.number, r.title, r.body])).toEqual([
      [3, '3 つ目の題', '3 つ目の題の本文'],
      [2, '2 つ目の題', '2 つ目の題の本文'],
      [1, '1 つ目の題', '1 つ目の題の本文'],
    ]);
    expect(await notes.findRevision(id, 1)).toMatchObject({ title: '1 つ目の題' });
    expect(await notes.findRevision(id, 4)).toBeNull();
    expect(await notes.hasRevision(id, 3)).toBe(true);
    expect(await notes.hasRevision(id, 4)).toBe(false);
  });

  it('開いたときの版の番号が最新でなければ、版も識別子も書かない', async () => {
    const id = await create();
    await notes.save(id, 'fake-note', content('画面 A の保存'), 1);
    expect(await notes.save(id, 'other-slug', content('画面 B の保存'), 1)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(await notes.findForEdit(id)).toMatchObject({
      slug: 'fake-note',
      latest: { number: 2, title: '画面 A の保存' },
    });
  });

  it('版を書き換えられない（FR-006）', async () => {
    const id = await create();
    await expect(
      env.DB.prepare("UPDATE note_revision SET title = '書き換え' WHERE note_id = ?")
        .bind(id)
        .run(),
    ).rejects.toThrow(/note_revision_immutable/);
  });

  it('下書きのうちは識別子を変えられ、ほかの note の識別子とは重ならない（FR-002・FR-003）', async () => {
    const id = await create('fake-note');
    await create('taken-slug', '別の note');
    expect(await notes.save(id, 'renamed', content('題'), 1)).toMatchObject({ ok: true });
    expect(await notes.save(id, 'taken-slug', content('題'), 2)).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });
});

describe('公開と下書き（FR-010〜FR-015・SC-004）', () => {
  it('公開すると最新の版が公開した版になり、初めて公開した日時は公開し直しても変わらない', async () => {
    const id = await create();
    expect(await notes.publish(id, 1, T1)).toEqual({ ok: true });
    await notes.save(id, 'fake-note', content('2 つ目の題'), 1);
    expect(await notes.findForEdit(id)).toMatchObject({
      status: 'published',
      publishedRevisionNumber: 1,
      publishedAt: T1,
    });
    expect(await notes.findVisitorBySlug('fake-note')).toMatchObject({ title: '1 つ目の題' });

    expect(await notes.publish(id, 2, T2)).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toMatchObject({
      publishedRevisionNumber: 2,
      publishedAt: T1,
    });
    expect(await notes.findVisitorBySlug('fake-note')).toMatchObject({ title: '2 つ目の題' });
  });

  it('題が空の版は公開しない（FR-011）', async () => {
    const result = await notes.create('empty-title', content(''));
    if (!result.ok) throw new Error();
    expect(await notes.publish(result.id, 1, T1)).toEqual({ ok: false, reason: 'empty-title' });
    expect(await readNote(result.id)).toMatchObject({ status: 'draft', published_at: null });
  });

  it('開いた後に別の画面で保存されていたら、公開しない（research.md の R4）', async () => {
    const id = await create();
    await notes.save(id, 'fake-note', content('見ていない版'), 1);
    expect(await notes.publish(id, 1, T1)).toEqual({ ok: false, reason: 'conflict' });
    expect(await notes.findVisitorBySlug('fake-note')).toBeNull();
  });

  it('公開した note の識別子は変えられない（FR-003・User Story 1 の 6）', async () => {
    const id = await create();
    await notes.publish(id, 1, T1);
    expect(await notes.save(id, 'renamed', content('題'), 1)).toEqual({
      ok: false,
      reason: 'slug-locked',
    });
  });

  it('下書きに戻すと訪問者に出さず、公開した版と日時は残り、公開し直しても日時は同じ（FR-014・User Story 2 の 2）', async () => {
    const id = await create();
    await notes.publish(id, 1, T1);
    expect(await notes.unpublish(id)).toEqual({ ok: true });
    expect(await notes.findVisitorBySlug('fake-note')).toBeNull();
    expect(await notes.hasVisitorSlug('fake-note')).toBe(false);
    expect(await readNote(id)).toMatchObject({ status: 'draft', published_at: T1 });
    expect(await notes.publish(id, 1, T2)).toEqual({ ok: true });
    expect(await readNote(id)).toMatchObject({ published_at: T1 });
  });
});

describe('削除と戻す（FR-016・SC-007）', () => {
  it('公開した note を削除すると訪問者に出さず、戻すと公開と同じ版に戻る', async () => {
    const id = await create();
    await notes.publish(id, 1, T1);
    await notes.save(id, 'fake-note', content('公開していない版'), 1);
    expect(await notes.delete(id, T2)).toEqual({ ok: true });
    expect(await notes.findVisitorBySlug('fake-note')).toBeNull();
    expect(await notes.findForEdit(id)).toMatchObject({ isDeleted: true });

    expect(await notes.undelete(id)).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toMatchObject({
      isDeleted: false,
      status: 'published',
      slug: 'fake-note',
      publishedRevisionNumber: 1,
      latest: { number: 2 },
    });
    expect(await notes.findVisitorBySlug('fake-note')).toMatchObject({ title: '1 つ目の題' });
  });

  it('削除した note は、戻すまで保存・公開・下書きに戻す・転載先を受け付けない', async () => {
    const id = await create();
    await notes.delete(id, T1);
    expect(await notes.save(id, 'fake-note', content('題'), 1)).toEqual({
      ok: false,
      reason: 'deleted',
    });
    expect(await notes.publish(id, 1, T1)).toEqual({ ok: false, reason: 'deleted' });
    expect(await notes.unpublish(id)).toEqual({ ok: false, reason: 'deleted' });
    expect(await notes.addSyndication(id, 'https://example.com/a')).toEqual({
      ok: false,
      reason: 'deleted',
    });
  });

  it('下書きの note を削除して戻すと、下書きと版に戻る（User Story 2 の 6）', async () => {
    const id = await create();
    await notes.delete(id, T1);
    await notes.undelete(id);
    expect(await notes.findForEdit(id)).toMatchObject({ status: 'draft', latest: { number: 1 } });
  });
});

describe('転載先（FR-031・FR-032）', () => {
  it('2 つ記録でき、同じ URL は別の note にも記録できない', async () => {
    const a = await create('note-a');
    const b = await create('note-b');
    expect(await notes.addSyndication(a, 'https://example.com/1')).toEqual({ ok: true });
    expect(await notes.addSyndication(a, 'https://example.com/2')).toEqual({ ok: true });
    expect(await notes.addSyndication(b, 'https://example.com/1')).toEqual({
      ok: false,
      reason: 'syndication-taken',
    });
    expect((await notes.findForEdit(a))?.syndications).toEqual([
      'https://example.com/1',
      'https://example.com/2',
    ]);
    expect(await notes.removeSyndication(a, 'https://example.com/1')).toEqual({ ok: true });
    expect((await notes.findForEdit(a))?.syndications).toEqual(['https://example.com/2']);
  });
});

describe('参照先の情報（FR-028・FR-029）', () => {
  it('URL ごとに 1 つ持ち、取り直すと替わる', async () => {
    await notes.saveLinkPreviews(
      [{ url: 'https://example.com/x', title: '前の題', imageUrl: null }],
      T1,
    );
    await notes.saveLinkPreviews(
      [
        {
          url: 'https://example.com/x',
          title: '取り直した題',
          imageUrl: 'https://example.com/i.png',
        },
      ],
      T2,
    );
    expect(
      await notes.findLinkPreviews(['https://example.com/x', 'https://example.com/none']),
    ).toEqual([
      {
        url: 'https://example.com/x',
        title: '取り直した題',
        imageUrl: 'https://example.com/i.png',
      },
    ]);
    const { n } = (await env.DB.prepare('SELECT count(*) AS n FROM link_preview').first<{
      n: number;
    }>())!;
    expect(n).toBe(1);
  });
});

describe('完全に消す（FR-017、research.md の R13）', () => {
  it('note・版・画像・転載先を一緒に消し、参照先の情報は残す', async () => {
    const { id } = await insertNote(env.DB, {
      slug: 'purged',
      revisions: [{ title: '題', body: 'https://example.com/kept' }],
      publishedRevision: 1,
    });
    const mediaId = await insertNoteMedia(env.DB, id, 'notes/purged.png');
    await env.DB.prepare("UPDATE note SET card_image = 'media', card_media_id = ? WHERE id = ?")
      .bind(mediaId, id)
      .run();
    await notes.addSyndication(id, 'https://example.com/purged');
    await notes.saveLinkPreviews(
      [{ url: 'https://example.com/kept', title: '残る', imageUrl: null }],
      T1,
    );

    expect(await notes.purge(id)).toEqual({ ok: true, storageKeys: ['notes/purged.png'] });
    for (const table of ['note', 'note_revision', 'syndication']) {
      const column = table === 'note' ? 'id' : 'note_id';
      const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${column} = ?`)
        .bind(id)
        .first<{ n: number }>();
      expect(row?.n).toBe(0);
    }
    expect(
      (
        await env.DB.prepare('SELECT count(*) AS n FROM media WHERE note_id = ?')
          .bind(id)
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    expect(await notes.findLinkPreviews(['https://example.com/kept'])).toHaveLength(1);
  });
});

describe('一覧', () => {
  it('削除した note も含め、最新の版の題と番号を返す', async () => {
    const id = await create('listed');
    await notes.save(id, 'listed', content('2 つ目'), 1);
    await notes.delete(id, T1);
    expect(await notes.list()).toEqual([
      expect.objectContaining({
        slug: 'listed',
        title: '2 つ目',
        isDeleted: true,
        latestRevisionNumber: 2,
        publishedRevisionNumber: null,
      }),
    ]);
  });
});
