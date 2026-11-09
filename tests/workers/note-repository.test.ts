import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NoteInput } from '@/features/note/domain/note';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';
import {
  deleteNoteRow,
  deleteNoteRows,
  insertNote,
  insertLinkPreview,
  insertNoteMedia,
  insertNoteRevision,
  publishNoteRow,
} from '../support/note-rows';

/**
 * `NoteRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる
 * （specs/003-note/spec.md、research.md の R4〜R7）
 */

const notes = createD1NoteRepository(env.DB);

const NOW = '2026-11-05T00:00:00.000Z';
const LATER = '2026-11-06T00:00:00.000Z';

const input = (overrides: Partial<NoteInput> = {}): NoteInput => ({
  slug: `note-${crypto.randomUUID()}`,
  title: '作り物の題',
  description: null,
  body: '作り物の本文',
  ...overrides,
});

const create = async (overrides: Partial<NoteInput> = {}) => {
  const result = await notes.create(input(overrides));
  if (!result.ok) throw new Error(`note を作れなかった: ${result.reason}`);
  return result;
};

const latestRevisionUid = async (id: number) => {
  const note = await notes.findForEdit(id);
  if (!note) throw new Error(`note ${id} が無い`);
  return note.latestRevision.uid;
};

const revisionsOf = async (id: number) =>
  (
    await env.DB.prepare(
      'SELECT title, description, body FROM note_revision WHERE note_id = ? ORDER BY id',
    )
      .bind(id)
      .all()
  ).results;

const readNoteRow = (id: number) =>
  env.DB.prepare('SELECT * FROM note WHERE id = ?')
    .bind(id)
    .first<{ status: string; slug: string; published_at: string | null }>();

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteNoteRows(env.DB);
});

describe('create（FR-001）', () => {
  it('作った note は下書きで、1 つ目の版を持つ', async () => {
    const { id, uid } = await create({ title: '一つ目の題', description: '説明' });
    expect(uid).toMatch(/^[0-9a-f]{32}$/);
    expect((await readNoteRow(id))?.status).toBe('draft');
    expect(await revisionsOf(id)).toEqual([
      { title: '一つ目の題', description: '説明', body: '作り物の本文' },
    ]);
  });

  it('識別子が削除した note と重なれば作らない（FR-002、User Story 2 の 4）', async () => {
    const existing = await insertNote(env.DB, { slug: 'sample-note' });
    await deleteNoteRow(env.DB, existing.id);
    expect(await notes.create(input({ slug: 'sample-note' }))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect(
      await env.DB.prepare('SELECT count(*) AS n FROM note_revision').first<{ n: number }>(),
    ).toEqual({ n: 1 });
  });
});

describe('findForEdit（FR-007）', () => {
  it('最も新しい版と、公開した版の uid を持つ', async () => {
    const note = await insertNote(env.DB, { title: '公開した題' });
    await publishNoteRow(env.DB, note.id);
    const latest = await insertNoteRevision(env.DB, note.id, { title: '新しい題' });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      uid: note.uid,
      status: 'published',
      publishedAt: '2026-11-01T00:00:00.000Z',
      deletedAt: null,
      cardImage: 'generated',
      cardMediaStorageKey: null,
      latestRevision: { uid: latest.uid, title: '新しい題' },
      publishedRevisionUid: note.revision.uid,
      mediaStorageKeys: [],
      syndicationUrls: [],
    });
  });

  it('無い id なら null', async () => {
    expect(await notes.findForEdit(999_999)).toBeNull();
  });
});

describe('findIdByUid', () => {
  it('削除した note の id も返す（contracts/dash.md の共通）', async () => {
    const note = await insertNote(env.DB);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.findIdByUid(note.uid)).toBe(note.id);
  });

  it('無い uid なら null', async () => {
    expect(await notes.findIdByUid('0'.repeat(32))).toBeNull();
  });
});

describe('list', () => {
  it('最も新しい版の題・状態・削除したかを、削除した note も含めて返す', async () => {
    const kept = await insertNote(env.DB, { slug: 'kept', title: '古い題' });
    await insertNoteRevision(env.DB, kept.id, { title: '新しい題' });
    const removed = await insertNote(env.DB, { slug: 'removed' });
    await deleteNoteRow(env.DB, removed.id);
    const list = await notes.list();
    expect(list).toHaveLength(2);
    expect(list.find((n) => n.slug === 'kept')).toMatchObject({
      uid: kept.uid,
      title: '新しい題',
      status: 'draft',
      isDeleted: false,
    });
    expect(list.find((n) => n.slug === 'removed')?.isDeleted).toBe(true);
  });
});

describe('save（FR-006・FR-020・FR-021、research.md の R4）', () => {
  it('保存のたびに版が 1 つ増え、前の版は保存したときのまま読める（SC-003）', async () => {
    const { id } = await create({ title: '1', body: '一' });
    const s1 = await notes.save(id, input({ title: '2', body: '二' }), await latestRevisionUid(id));
    const s2 = await notes.save(id, input({ title: '3', body: '三' }), await latestRevisionUid(id));
    expect([s1, s2]).toEqual([{ ok: true }, { ok: true }]);
    expect((await revisionsOf(id)).map((r) => [r.title, r.body])).toEqual([
      ['1', '一'],
      ['2', '二'],
      ['3', '三'],
    ]);
  });

  it('開いた版が最も新しい版でなければ書かず conflict（FR-020）', async () => {
    const { id } = await create();
    const opened = await latestRevisionUid(id);
    expect(await notes.save(id, input({ title: '画面 A' }), opened)).toEqual({ ok: true });
    expect(await notes.save(id, input({ title: '画面 B' }), opened)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect((await revisionsOf(id)).map((r) => r.title)).toEqual(['作り物の題', '画面 A']);
  });

  it('保存した版を次に比べる版にすれば、続けて 2 回の保存が通る（FR-021）', async () => {
    const { id } = await create();
    expect(await notes.save(id, input({ title: '1 回目' }), await latestRevisionUid(id))).toEqual({
      ok: true,
    });
    expect(await notes.save(id, input({ title: '2 回目' }), await latestRevisionUid(id))).toEqual({
      ok: true,
    });
  });

  it('削除した note には書かず not-found', async () => {
    const note = await insertNote(env.DB);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.save(note.id, input(), note.revision.uid)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(await revisionsOf(note.id)).toHaveLength(1);
  });

  it('無い note には書かず not-found', async () => {
    expect(await notes.save(999_999, input(), '0'.repeat(32))).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('一度も公開していない note の識別子を、版の追加と一緒に変える（FR-003）', async () => {
    const note = await insertNote(env.DB, { slug: 'before' });
    expect(await notes.save(note.id, input({ slug: 'after' }), note.revision.uid)).toEqual({
      ok: true,
    });
    expect((await readNoteRow(note.id))?.slug).toBe('after');
    expect(await revisionsOf(note.id)).toHaveLength(2);
  });

  it('識別子が削除した note と重なれば、識別子も版も書かない（FR-002）', async () => {
    const other = await insertNote(env.DB, { slug: 'taken' });
    await deleteNoteRow(env.DB, other.id);
    const note = await insertNote(env.DB, { slug: 'mine' });
    expect(await notes.save(note.id, input({ slug: 'taken' }), note.revision.uid)).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect((await readNoteRow(note.id))?.slug).toBe('mine');
    expect(await revisionsOf(note.id)).toHaveLength(1);
  });

  it('公開したことのある note の識別子は、トリガが拒み、版も書かない（FR-003）', async () => {
    const note = await insertNote(env.DB, { slug: 'fixed' });
    await publishNoteRow(env.DB, note.id);
    expect(await notes.save(note.id, input({ slug: 'moved' }), note.revision.uid)).toEqual({
      ok: false,
      reason: 'slug-locked',
    });
    expect((await readNoteRow(note.id))?.slug).toBe('fixed');
    expect(await revisionsOf(note.id)).toHaveLength(1);
  });

  it('識別子が開いた版と比べて当たらなければ、識別子も書かない', async () => {
    const note = await insertNote(env.DB, { slug: 'before' });
    await insertNoteRevision(env.DB, note.id);
    expect(await notes.save(note.id, input({ slug: 'after' }), note.revision.uid)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect((await readNoteRow(note.id))?.slug).toBe('before');
  });
});

describe('publish（FR-011・FR-013、research.md の R5）', () => {
  it('最も新しい版が公開した版になり、初めて公開した日時を入れる', async () => {
    const note = await insertNote(env.DB);
    const latest = await insertNoteRevision(env.DB, note.id, { title: '新しい題' });
    expect(await notes.publish(note.id, NOW)).toEqual({ ok: true });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      status: 'published',
      publishedAt: NOW,
      publishedRevisionUid: latest.uid,
    });
  });

  it('2 回目の公開で初めて公開した日時が変わらない（SC-004）', async () => {
    const note = await insertNote(env.DB);
    await notes.publish(note.id, NOW);
    const latest = await insertNoteRevision(env.DB, note.id, { title: '直した題' });
    expect(await notes.publish(note.id, LATER)).toEqual({ ok: true });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      publishedAt: NOW,
      publishedRevisionUid: latest.uid,
    });
  });

  it('最も新しい版の題が空なら untitled で、公開しない', async () => {
    const note = await insertNote(env.DB, { title: '' });
    expect(await notes.publish(note.id, NOW)).toEqual({ ok: false, reason: 'untitled' });
    expect((await readNoteRow(note.id))?.status).toBe('draft');
  });

  it('削除した note は公開せず not-found', async () => {
    const note = await insertNote(env.DB);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.publish(note.id, NOW)).toEqual({ ok: false, reason: 'not-found' });
    expect((await readNoteRow(note.id))?.status).toBe('draft');
  });
});

describe('findVisitorBySlug（FR-012・FR-015、research.md の R7）', () => {
  it('公開した版だけを返し、公開した後に保存した版を返さない', async () => {
    const note = await insertNote(env.DB, {
      slug: 'visible',
      title: '公開した題',
      description: '公開した説明',
      body: '公開した本文',
    });
    await publishNoteRow(env.DB, note.id);
    await insertNoteRevision(env.DB, note.id, { title: '後の題', body: '後の本文' });
    expect(await notes.findVisitorBySlug('visible')).toEqual({
      slug: 'visible',
      title: '公開した題',
      description: '公開した説明',
      summary: '公開した説明',
      body: '公開した本文',
      publishedAt: '2026-11-01T00:00:00.000Z',
      cardImage: { kind: 'generated' },
      media: [],
      linkPreviews: [],
    });
    expect(await notes.hasVisitorSlug('visible')).toBe(true);
  });

  it('下書きの note を返さない', async () => {
    await insertNote(env.DB, { slug: 'draft-note' });
    expect(await notes.findVisitorBySlug('draft-note')).toBeNull();
    expect(await notes.hasVisitorSlug('draft-note')).toBe(false);
  });

  it('削除した公開の note を返さない（FR-016）', async () => {
    const note = await insertNote(env.DB, { slug: 'deleted-note' });
    await publishNoteRow(env.DB, note.id);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.findVisitorBySlug('deleted-note')).toBeNull();
    expect(await notes.hasVisitorSlug('deleted-note')).toBe(false);
  });
});

describe('findVisitorBySlug の本文の読み出し（T006、research.md の R11）', () => {
  it('その note の media の行に無い storageKey を DTO に入れない', async () => {
    const note = await insertNote(env.DB, { slug: 'with-media' });
    const other = await insertNote(env.DB, { slug: 'other-media' });
    const own = await insertNoteMedia(env.DB, note.id);
    const foreign = await insertNoteMedia(env.DB, other.id);
    const missing = crypto.randomUUID();
    await insertNoteRevision(env.DB, note.id, {
      body: [
        `![自分の画像](media:${own.storageKey} "キャプション")`,
        `![別の note の画像](media:${foreign.storageKey})`,
        `![無い画像](media:${missing})`,
      ].join('\n\n'),
    });
    await publishNoteRow(env.DB, note.id);
    expect((await notes.findVisitorBySlug('with-media'))?.media).toEqual([own.storageKey]);
  });

  it('説明文が空なら、本文の最初の段落が説明になる', async () => {
    const note = await insertNote(env.DB, {
      slug: 'no-description',
      description: null,
      body: '# 見出し\n\n最初の\n段落\n\n次の段落',
    });
    await publishNoteRow(env.DB, note.id);
    expect(await notes.findVisitorBySlug('no-description')).toMatchObject({
      description: null,
      summary: '最初の 段落',
    });
  });

  it('説明文があれば、説明文のまま', async () => {
    const note = await insertNote(env.DB, { slug: 'has-description', description: '説明文' });
    await publishNoteRow(env.DB, note.id);
    expect((await notes.findVisitorBySlug('has-description'))?.summary).toBe('説明文');
  });

  it('URL だけの段落が指す参照先の情報を、取ったことのある URL だけ入れる', async () => {
    await insertLinkPreview(env.DB, {
      url: 'https://example.com/known',
      title: '参照先の題',
      imageUrl: 'https://example.com/known.png',
    });
    const note = await insertNote(env.DB, {
      slug: 'with-links',
      body: 'https://example.com/known\n\nhttps://example.com/unknown\n\n文の中の https://example.com/inline',
    });
    await publishNoteRow(env.DB, note.id);
    expect((await notes.findVisitorBySlug('with-links'))?.linkPreviews).toEqual([
      {
        url: 'https://example.com/known',
        title: '参照先の題',
        imageUrl: 'https://example.com/known.png',
      },
    ]);
  });
});

describe('unpublish・delete・restore（FR-014・FR-016・SC-007、research.md の R5）', () => {
  it('下書きに戻しても、公開した版と初めて公開した日時が残る（FR-014）', async () => {
    const note = await insertNote(env.DB, { slug: 'unpublished' });
    await notes.publish(note.id, NOW);
    expect(await notes.unpublish(note.id)).toEqual({ ok: true });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      status: 'draft',
      publishedAt: NOW,
      publishedRevisionUid: note.revision.uid,
    });
    expect(await notes.findVisitorBySlug('unpublished')).toBeNull();
  });

  it('下書きに戻して公開し直すと、初めて公開した日時は戻す前と同じ（User Story 2 の 2）', async () => {
    const note = await insertNote(env.DB);
    await notes.publish(note.id, NOW);
    await notes.unpublish(note.id);
    await notes.publish(note.id, LATER);
    expect((await notes.findForEdit(note.id))?.publishedAt).toBe(NOW);
  });

  it('削除した note は下書きに戻さない', async () => {
    const note = await insertNote(env.DB);
    await notes.publish(note.id, NOW);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.unpublish(note.id)).toEqual({ ok: false });
    expect((await readNoteRow(note.id))?.status).toBe('published');
  });

  it('削除しても状態と版が残り、訪問者に出さない（FR-016）', async () => {
    const note = await insertNote(env.DB, { slug: 'removed-published' });
    await notes.publish(note.id, NOW);
    expect(await notes.delete(note.id, LATER)).toEqual({ ok: true });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      status: 'published',
      deletedAt: LATER,
      publishedRevisionUid: note.revision.uid,
    });
    expect(await revisionsOf(note.id)).toHaveLength(1);
    expect(await notes.findVisitorBySlug('removed-published')).toBeNull();
  });

  it('公開した note を削除して元に戻すと、公開に戻り同じ版を訪問者が読める（User Story 2 の 5）', async () => {
    const note = await insertNote(env.DB, { slug: 'restored-published', title: '戻した題' });
    await notes.publish(note.id, NOW);
    await notes.delete(note.id, LATER);
    expect(await notes.restore(note.id)).toEqual({ ok: true });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      status: 'published',
      deletedAt: null,
      slug: 'restored-published',
    });
    expect((await notes.findVisitorBySlug('restored-published'))?.title).toBe('戻した題');
  });

  it('下書きの note を削除して元に戻すと、下書きに戻り削除前の版を持つ（User Story 2 の 6）', async () => {
    const note = await insertNote(env.DB, { title: '下書きの題' });
    await notes.delete(note.id, LATER);
    await notes.restore(note.id);
    expect(await notes.findForEdit(note.id)).toMatchObject({
      status: 'draft',
      deletedAt: null,
      latestRevision: { uid: note.revision.uid, title: '下書きの題' },
    });
  });

  it('削除した note の識別子で別の note を作れない（User Story 2 の 4）', async () => {
    const note = await insertNote(env.DB, { slug: 'sample-note' });
    await notes.delete(note.id, LATER);
    expect(await notes.create(input({ slug: 'sample-note' }))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });

  it('無い id は ok: false', async () => {
    expect(await notes.delete(999_999, NOW)).toEqual({ ok: false });
    expect(await notes.restore(999_999)).toEqual({ ok: false });
  });
});

describe('版の一覧と過去の版に戻す（FR-008・FR-009、User Story 3 の 1・2）', () => {
  const saveThree = async () => {
    const note = await insertNote(env.DB, { title: '1 つ目', body: '一' });
    await insertNoteRevision(env.DB, note.id, { title: '2 つ目', body: '二' });
    const third = await insertNoteRevision(env.DB, note.id, { title: '3 つ目', body: '三' });
    return { note, third };
  };

  it('版の一覧が新しい順で、最も新しい版と公開した版に印がある', async () => {
    const { note, third } = await saveThree();
    await env.DB.prepare(
      "UPDATE note SET status = 'published', published_revision_id = ?, published_at = ? WHERE id = ?",
    )
      .bind(note.revision.id, NOW, note.id)
      .run();
    const list = await notes.listRevisions(note.id);
    expect(list.map((r) => [r.title, r.isLatest, r.isPublished])).toEqual([
      ['3 つ目', true, false],
      ['2 つ目', false, false],
      ['1 つ目', false, true],
    ]);
    expect(list[0]?.uid).toBe(third.uid);
  });

  it('1 つの版を保存したときのまま読み、別の note の版を返さない', async () => {
    const { note } = await saveThree();
    const other = await insertNote(env.DB);
    expect(await notes.findRevision(note.id, note.revision.uid)).toMatchObject({
      title: '1 つ目',
      body: '一',
    });
    expect(await notes.findRevision(other.id, note.revision.uid)).toBeNull();
  });

  it('戻すと、戻した版の中身が 4 つ目の版として足され、3 つの版が残る', async () => {
    const { note, third } = await saveThree();
    expect(await notes.revert(note.id, note.revision.uid, third.uid)).toEqual({ ok: true });
    expect((await revisionsOf(note.id)).map((r) => [r.title, r.body])).toEqual([
      ['1 つ目', '一'],
      ['2 つ目', '二'],
      ['3 つ目', '三'],
      ['1 つ目', '一'],
    ]);
  });

  it('開いた版が最も新しい版でなければ戻さない（FR-020）', async () => {
    const { note } = await saveThree();
    expect(await notes.revert(note.id, note.revision.uid, note.revision.uid)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(await revisionsOf(note.id)).toHaveLength(3);
  });

  it('戻しても公開した版は変わらない（FR-009）', async () => {
    const note = await insertNote(env.DB, { title: '公開した題' });
    await notes.publish(note.id, NOW);
    const latest = await insertNoteRevision(env.DB, note.id, { title: '後の題' });
    await notes.revert(note.id, note.revision.uid, latest.uid);
    expect((await notes.findForEdit(note.id))?.publishedRevisionUid).toBe(note.revision.uid);
  });

  it('別の note の版には戻さない', async () => {
    const note = await insertNote(env.DB);
    const other = await insertNote(env.DB);
    expect(await notes.revert(note.id, other.revision.uid, note.revision.uid)).toEqual({
      ok: false,
      reason: 'revision-not-found',
    });
  });

  it('削除した note は戻さず not-found', async () => {
    const note = await insertNote(env.DB);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.revert(note.id, note.revision.uid, note.revision.uid)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('過去の版の画面の有無を、note と版の両方で見分ける', async () => {
    const note = await insertNote(env.DB);
    const other = await insertNote(env.DB);
    expect(await notes.findMissingRevision(note.uid, note.revision.uid)).toBeNull();
    expect(await notes.findMissingRevision(note.uid, other.revision.uid)).toBe('revision');
    expect(await notes.findMissingRevision('0'.repeat(32), note.revision.uid)).toBe('note');
  });
});

describe('転載先（FR-031・FR-032、User Story 7、research.md の R14）', () => {
  it('2 つ記録でき、記録した順に読める', async () => {
    const note = await insertNote(env.DB);
    expect(await notes.addSyndication(note.id, 'https://example.com/one')).toEqual({ ok: true });
    expect(await notes.addSyndication(note.id, 'https://example.com/two')).toEqual({ ok: true });
    expect((await notes.findForEdit(note.id))?.syndicationUrls).toEqual([
      'https://example.com/one',
      'https://example.com/two',
    ]);
  });

  it('同じ URL を同じ note にも別の note にも記録できない（FR-032）', async () => {
    const a = await insertNote(env.DB);
    const b = await insertNote(env.DB);
    await notes.addSyndication(a.id, 'https://example.com/taken');
    expect(await notes.addSyndication(a.id, 'https://example.com/taken')).toEqual({
      ok: false,
      reason: 'url-taken',
    });
    expect(await notes.addSyndication(b.id, 'https://example.com/taken')).toEqual({
      ok: false,
      reason: 'url-taken',
    });
  });

  it('削除した note には記録しない', async () => {
    const note = await insertNote(env.DB);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.addSyndication(note.id, 'https://example.com/deleted')).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('URL で指して外し、別の note の URL は外さない', async () => {
    const a = await insertNote(env.DB);
    const b = await insertNote(env.DB);
    await notes.addSyndication(a.id, 'https://example.com/a');
    await notes.addSyndication(b.id, 'https://example.com/b');
    expect(await notes.removeSyndication(a.id, 'https://example.com/b')).toEqual({ ok: false });
    expect(await notes.removeSyndication(a.id, 'https://example.com/a')).toEqual({ ok: true });
    expect((await notes.findForEdit(a.id))?.syndicationUrls).toEqual([]);
    expect((await notes.findForEdit(b.id))?.syndicationUrls).toEqual(['https://example.com/b']);
  });
});

describe('代表画像と画像（FR-023〜FR-025、User Story 5 の 3）', () => {
  it('代表画像の既定は generated で、site に変えられる', async () => {
    const note = await insertNote(env.DB);
    expect((await notes.findForEdit(note.id))?.cardImage).toBe('generated');
    expect(await notes.changeCardImage(note.id, { kind: 'site' })).toEqual({ ok: true });
    expect((await notes.findForEdit(note.id))?.cardImage).toBe('site');
    expect(await notes.changeCardImage(note.id, { kind: 'generated' })).toEqual({ ok: true });
    expect((await notes.findForEdit(note.id))?.cardImage).toBe('generated');
  });

  it('その note の画像を代表画像にできる', async () => {
    const note = await insertNote(env.DB, { slug: 'card-media' });
    const media = await insertNoteMedia(env.DB, note.id);
    expect(await notes.changeCardImage(note.id, { kind: 'media', ...media })).toEqual({
      ok: true,
    });
    expect(await notes.findForEdit(note.id)).toMatchObject({
      cardImage: 'media',
      cardMediaStorageKey: media.storageKey,
    });
    await publishNoteRow(env.DB, note.id);
    expect((await notes.findVisitorBySlug('card-media'))?.cardImage).toEqual({
      kind: 'media',
      storageKey: media.storageKey,
    });
  });

  it('別の note の画像を代表画像に選べない（FR-025）', async () => {
    const a = await insertNote(env.DB);
    const b = await insertNote(env.DB);
    const foreign = await insertNoteMedia(env.DB, b.id);
    expect(
      await notes.changeCardImage(a.id, { kind: 'media', storageKey: foreign.storageKey }),
    ).toEqual({ ok: false, reason: 'media-not-owned' });
    expect((await notes.findForEdit(a.id))?.cardImage).toBe('generated');
  });

  it('削除した note の代表画像は変えない', async () => {
    const note = await insertNote(env.DB);
    await deleteNoteRow(env.DB, note.id);
    expect(await notes.changeCardImage(note.id, { kind: 'site' })).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('画像をその note の画像として記録し、削除した note には記録しない', async () => {
    const note = await insertNote(env.DB);
    const key = crypto.randomUUID();
    expect(await notes.addMedia(note.id, key)).toEqual({ ok: true });
    expect((await notes.findForEdit(note.id))?.mediaStorageKeys).toEqual([key]);

    const deleted = await insertNote(env.DB);
    await deleteNoteRow(env.DB, deleted.id);
    expect(await notes.addMedia(deleted.id, crypto.randomUUID())).toEqual({ ok: false });
  });
});
