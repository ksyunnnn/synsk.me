/**
 * D1 に note の作り物の行を入れる道具。workerd の検査と結合の検査が使う。値はすべて作り物。
 * 列の正本は migrations/0005 と 0015 にある
 */

export type NoteRowInput = {
  slug: string;
  /** 古い順の版。1 つ以上 */
  revisions: { title: string; description?: string | null; body: string }[];
  /** 公開する版の番号（1 から）。無ければ一度も公開しない */
  publishedRevision?: number;
  /** 公開した後に下書きに戻したか */
  unpublished?: boolean;
  deleted?: boolean;
};

const AT = '2026-11-01T00:00:00.000Z';

/** note を入れ、id と uid を返す */
export const insertNote = async (
  db: D1Database,
  input: NoteRowInput,
): Promise<{ id: number; uid: string }> => {
  const note = await db
    .prepare('INSERT INTO note (slug) VALUES (?) RETURNING id, uid')
    .bind(input.slug)
    .first<{ id: number; uid: string }>();
  if (!note) throw new Error('note を入れられなかった');
  const revisionIds: number[] = [];
  for (const revision of input.revisions) {
    const row = await db
      .prepare(
        'INSERT INTO note_revision (note_id, title, description, body) VALUES (?, ?, ?, ?) RETURNING id',
      )
      .bind(note.id, revision.title, revision.description ?? null, revision.body)
      .first<{ id: number }>();
    revisionIds.push(row!.id);
  }
  if (input.publishedRevision !== undefined) {
    await db
      .prepare(
        'UPDATE note SET status = ?, published_revision_id = ?, published_at = ? WHERE id = ?',
      )
      .bind(
        input.unpublished ? 'draft' : 'published',
        revisionIds[input.publishedRevision - 1],
        AT,
        note.id,
      )
      .run();
  }
  if (input.deleted) {
    await db.prepare('UPDATE note SET deleted_at = ? WHERE id = ?').bind(AT, note.id).run();
  }
  return note;
};

/** note に画像の記録を入れる。R2 の物は入れない */
export const insertNoteMedia = async (db: D1Database, noteId: number, storageKey: string) => {
  const row = await db
    .prepare('INSERT INTO media (note_id, storage_key) VALUES (?, ?) RETURNING id')
    .bind(noteId, storageKey)
    .first<{ id: number }>();
  return row!.id;
};

/** note・版・画像・転載先・参照先の情報を消す。検査の間で行を残さない */
export const deleteNoteRows = (db: D1Database) =>
  db.batch([
    db.prepare("UPDATE note SET card_media_id = NULL, card_image = 'generated'"),
    db.prepare('DELETE FROM syndication'),
    db.prepare('DELETE FROM media WHERE note_id IS NOT NULL'),
    db.prepare('DELETE FROM note_revision'),
    db.prepare('DELETE FROM note'),
    db.prepare('DELETE FROM link_preview'),
  ]);
