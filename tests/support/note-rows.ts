/**
 * workerd と結合の検査が、作り物の note・版・転載先・参照先の情報と、持ち主が note の画像の行を
 * D1 に入れる道具（specs/003-note/tasks.md の T002）。値はすべて作り物。省いた列は、検査が値を
 * 気にしないときの既定の値で入れる。
 *
 * 行は Repository を通さずに SQL で入れる。Repository の検査の前提を、検査する実装に頼らずに
 * 作るため。各関数は入れた行の id と uid を返す。uid は DB が入れる（migrations/0012）
 */

type Inserted = { id: number; uid: string };

export type NoteRowInput = {
  slug?: string;
  /** 1 つ目の版の題。省くと作り物の題 */
  title?: string;
  description?: string | null;
  body?: string;
};

/** 下書きの note と、その 1 つ目の版を入れる。どの note も 1 つ以上の版を持つ */
export const insertNote = async (
  db: D1Database,
  {
    slug = `note-${crypto.randomUUID()}`,
    title = '作り物の note の題',
    description = null,
    body = '作り物の本文',
  }: NoteRowInput = {},
): Promise<Inserted & { revision: Inserted }> => {
  const note = await db
    .prepare('INSERT INTO note (slug) VALUES (?) RETURNING id, uid')
    .bind(slug)
    .first<Inserted>();
  if (!note) throw new Error('note に行を入れられなかった');
  const revision = await insertNoteRevision(db, note.id, { title, description, body });
  return { ...note, revision };
};

/** note に版を 1 つ足す */
export const insertNoteRevision = async (
  db: D1Database,
  noteId: number,
  {
    title = '作り物の note の題',
    description = null,
    body = '作り物の本文',
  }: Omit<NoteRowInput, 'slug'> = {},
): Promise<Inserted> => {
  const row = await db
    .prepare(
      'INSERT INTO note_revision (note_id, title, description, body) VALUES (?, ?, ?, ?) RETURNING id, uid',
    )
    .bind(noteId, title, description, body)
    .first<Inserted>();
  if (!row) throw new Error('note_revision に行を入れられなかった');
  return row;
};

/** note の最も新しい版を公開した版にする。初めて公開した日時は空のときだけ入れる */
export const publishNoteRow = (
  db: D1Database,
  noteId: number,
  publishedAt = '2026-11-01T00:00:00.000Z',
) =>
  db
    .prepare(
      `UPDATE note SET status = 'published',
         published_revision_id = (SELECT max(id) FROM note_revision WHERE note_id = ?1),
         published_at = COALESCE(published_at, ?2)
       WHERE id = ?1`,
    )
    .bind(noteId, publishedAt)
    .run();

/** note に削除済みの印を付ける */
export const deleteNoteRow = (db: D1Database, noteId: number) =>
  db
    .prepare("UPDATE note SET deleted_at = '2026-11-02T00:00:00.000Z' WHERE id = ?")
    .bind(noteId)
    .run();

/** 持ち主が note の画像の行を入れる。R2 には置かない */
export const insertNoteMedia = async (
  db: D1Database,
  noteId: number,
  storageKey: string = crypto.randomUUID(),
): Promise<{ id: number; storageKey: string }> => {
  const row = await db
    .prepare('INSERT INTO media (note_id, storage_key) VALUES (?, ?) RETURNING id')
    .bind(noteId, storageKey)
    .first<{ id: number }>();
  if (!row) throw new Error('media に行を入れられなかった');
  return { id: row.id, storageKey };
};

export const insertSyndication = async (db: D1Database, noteId: number, url: string) => {
  const row = await db
    .prepare('INSERT INTO syndication (note_id, url) VALUES (?, ?) RETURNING id')
    .bind(noteId, url)
    .first<{ id: number }>();
  if (!row) throw new Error('syndication に行を入れられなかった');
  return row.id;
};

export const insertLinkPreview = async (
  db: D1Database,
  {
    url,
    title = '作り物の参照先の題',
    imageUrl = null,
    fetchedAt = '2026-11-01T00:00:00.000Z',
  }: { url: string; title?: string | null; imageUrl?: string | null; fetchedAt?: string },
) => {
  const row = await db
    .prepare(
      'INSERT INTO link_preview (url, title, image_url, fetched_at) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(url, title, imageUrl, fetchedAt)
    .first<{ id: number }>();
  if (!row) throw new Error('link_preview に行を入れられなかった');
  return row.id;
};

/**
 * note と、note に属する行をすべて消す。note から版と画像を指す外部キーの検査はトランザクションの
 * 終わりに送られる（migrations/0005 の冒頭）ため、1 回の `batch()` でこの順に消せる
 */
export const deleteNoteRows = async (db: D1Database) => {
  await db.batch(
    [
      'DELETE FROM media WHERE note_id IS NOT NULL',
      'DELETE FROM syndication',
      'DELETE FROM link_preview',
      'DELETE FROM note_revision',
      'DELETE FROM note',
    ].map((sql) => db.prepare(sql)),
  );
};
