import 'server-only';

import type {
  Note,
  NoteCardImage,
  NoteStatus,
  NoteSummary,
  VisitorNote,
  VisitorNoteCardImage,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/**
 * `NoteRepository` の D1 の実装。行の型はこのファイルの中だけに置き、domain の型に詰め替える
 * （specs/001-career-and-project/research.md の R3）。列・CHECK・トリガの正本は migrations/ に
 * ある。複数の文は 1 つの `batch()`（1 つのトランザクション）で送る
 */

type NoteRow = {
  id: number;
  uid: string;
  slug: string;
  status: NoteStatus;
  published_at: string | null;
  deleted_at: string | null;
  card_image: NoteCardImage;
  card_media_storage_key: string | null;
  published_revision_uid: string | null;
};

type RevisionRow = {
  uid: string;
  title: string;
  description: string | null;
  body: string;
  created_at: string;
};

type VisitorRow = {
  slug: string;
  title: string;
  description: string | null;
  body: string;
  published_at: string;
  card_image: NoteCardImage;
  card_media_storage_key: string | null;
};

const toRevision = (row: RevisionRow) => ({
  uid: row.uid,
  title: row.title,
  description: row.description,
  body: row.body,
  createdAt: row.created_at,
});

/**
 * 訪問者に見せてよい note の条件（FR-012・FR-015・FR-016）。公開で削除していない note だけを
 * 読み、公開した版をつなぐ
 */
const VISITOR_FROM = `
  FROM note n
  JOIN note_revision r ON r.id = n.published_revision_id AND r.note_id = n.id
  LEFT JOIN media m ON m.id = n.card_media_id AND m.note_id = n.id
  WHERE n.slug = ? AND n.status = 'published' AND n.deleted_at IS NULL`;

/** 最も新しい版の uid。版は書き換えず消さないため、id の最も大きい版が最も新しい（R4） */
const LATEST_REVISION_UID =
  '(SELECT uid FROM note_revision WHERE note_id = ? ORDER BY id DESC LIMIT 1)';

/**
 * 書いてよい条件（research.md の R4）。最も新しい版が開いたときの版と同じで、note を削除して
 * いない。バインドする値は note の id・開いた版の uid・note の id の順
 */
const WRITABLE = `${LATEST_REVISION_UID} = ?
  AND EXISTS (SELECT 1 FROM note WHERE id = ? AND deleted_at IS NULL)`;

const errorIncludes = (error: unknown, text: string) =>
  error instanceof Error && error.message.includes(text);

const toCardImage = (cardImage: NoteCardImage, storageKey: string | null): VisitorNoteCardImage => {
  if (cardImage === 'media' && storageKey !== null) return { kind: 'media', storageKey };
  // 外部キーと CHECK が media の行を持たない `media` を許さない。読めなければ自動で作る画像に倒す
  return cardImage === 'site' ? { kind: 'site' } : { kind: 'generated' };
};

export const createD1NoteRepository = (db: D1Database): NoteRepository => {
  /** 無いか削除した note か */
  const isMissing = async (id: number) =>
    (await db
      .prepare('SELECT 1 AS found FROM note WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first()) === null;

  return {
    findVisitorBySlug: async (slug) => {
      const row = await db
        .prepare(
          `SELECT n.slug, r.title, r.description, r.body, n.published_at, n.card_image,
             m.storage_key AS card_media_storage_key ${VISITOR_FROM}`,
        )
        .bind(slug)
        .first<VisitorRow>();
      if (!row) return null;
      const dto: VisitorNote = {
        slug: row.slug,
        title: row.title,
        description: row.description,
        body: row.body,
        publishedAt: row.published_at,
        cardImage: toCardImage(row.card_image, row.card_media_storage_key),
      };
      return dto;
    },

    hasVisitorSlug: async (slug) =>
      (await db.prepare(`SELECT 1 AS found ${VISITOR_FROM}`).bind(slug).first()) !== null,

    findForEdit: async (id) => {
      const [noteResult, latestResult, mediaResult, syndicationResult] = await db.batch<
        NoteRow | RevisionRow | { storage_key: string } | { url: string }
      >([
        db
          .prepare(
            `SELECT n.id, n.uid, n.slug, n.status, n.published_at, n.deleted_at, n.card_image,
               m.storage_key AS card_media_storage_key, pr.uid AS published_revision_uid
             FROM note n
             LEFT JOIN media m ON m.id = n.card_media_id AND m.note_id = n.id
             LEFT JOIN note_revision pr ON pr.id = n.published_revision_id AND pr.note_id = n.id
             WHERE n.id = ?`,
          )
          .bind(id),
        db
          .prepare(
            `SELECT uid, title, description, body, created_at FROM note_revision
             WHERE note_id = ? ORDER BY id DESC LIMIT 1`,
          )
          .bind(id),
        db.prepare('SELECT storage_key FROM media WHERE note_id = ? ORDER BY id').bind(id),
        db.prepare('SELECT url FROM syndication WHERE note_id = ? ORDER BY id').bind(id),
      ]);
      const row = noteResult.results[0] as NoteRow | undefined;
      const latest = latestResult.results[0] as RevisionRow | undefined;
      if (!row || !latest) return null;
      const note: Note = {
        id: row.id,
        uid: row.uid,
        slug: row.slug,
        status: row.status,
        publishedAt: row.published_at,
        deletedAt: row.deleted_at,
        cardImage: row.card_image,
        cardMediaStorageKey: row.card_media_storage_key,
        latestRevision: toRevision(latest),
        publishedRevisionUid: row.published_revision_uid,
        mediaStorageKeys: (mediaResult.results as { storage_key: string }[]).map(
          (r) => r.storage_key,
        ),
        syndicationUrls: (syndicationResult.results as { url: string }[]).map((r) => r.url),
      };
      return note;
    },

    findIdByUid: async (uid) =>
      (await db.prepare('SELECT id FROM note WHERE uid = ?').bind(uid).first<{ id: number }>())
        ?.id ?? null,

    list: async () => {
      const { results } = await db
        .prepare(
          `SELECT n.uid, n.slug, n.status, n.deleted_at, n.created_at,
             (SELECT title FROM note_revision WHERE note_id = n.id ORDER BY id DESC LIMIT 1) AS title
           FROM note n ORDER BY n.created_at DESC, n.id DESC`,
        )
        .all<{
          uid: string;
          slug: string;
          status: NoteStatus;
          deleted_at: string | null;
          created_at: string;
          title: string | null;
        }>();
      return results.map((row): NoteSummary => ({
        uid: row.uid,
        slug: row.slug,
        title: row.title ?? '',
        status: row.status,
        isDeleted: row.deleted_at !== null,
        createdAt: row.created_at,
      }));
    },

    create: async (input) => {
      try {
        const [noteResult] = await db.batch<{ id: number; uid: string }>([
          db.prepare('INSERT INTO note (slug) VALUES (?) RETURNING id, uid').bind(input.slug),
          db
            .prepare(
              `INSERT INTO note_revision (note_id, title, description, body)
               SELECT id, ?, ?, ? FROM note WHERE slug = ?`,
            )
            .bind(input.title, input.description, input.body, input.slug),
        ]);
        const row = noteResult?.results[0];
        if (!row) throw new Error('note の行を作れなかった');
        return { ok: true, id: row.id, uid: row.uid };
      } catch (error) {
        if (errorIncludes(error, 'UNIQUE constraint failed: note.slug')) {
          return { ok: false, reason: 'slug-taken' };
        }
        throw error;
      }
    },

    save: async (id, input, openedRevisionUid) => {
      const guard = [id, openedRevisionUid, id];
      // 識別子の書き換えを、版の追加より前に置く。どちらも同じ条件で、条件に合わなければどちらも
      // 書かない。重複は UNIQUE が、公開した note の書き換えはトリガが拒み、batch() 全体が戻る
      const statements = [
        db
          .prepare(`UPDATE note SET slug = ? WHERE id = ? AND slug <> ? AND ${WRITABLE}`)
          .bind(input.slug, id, input.slug, ...guard),
        db
          .prepare(
            `INSERT INTO note_revision (note_id, title, description, body)
             SELECT ?, ?, ?, ? WHERE ${WRITABLE}`,
          )
          .bind(id, input.title, input.description, input.body, ...guard),
      ];
      let inserted: number;
      try {
        const results = await db.batch(statements);
        inserted = results[1]?.meta.changes ?? 0;
      } catch (error) {
        if (errorIncludes(error, 'UNIQUE constraint failed: note.slug')) {
          return { ok: false, reason: 'slug-taken' };
        }
        if (errorIncludes(error, 'note_slug_fixed_after_publication')) {
          return { ok: false, reason: 'slug-locked' };
        }
        throw error;
      }
      if (inserted > 0) return { ok: true };
      return { ok: false, reason: (await isMissing(id)) ? 'not-found' : 'conflict' };
    },

    publish: async (id, now) => {
      try {
        const result = await db
          .prepare(
            `UPDATE note SET status = 'published',
               published_revision_id = (SELECT max(id) FROM note_revision WHERE note_id = ?1),
               published_at = COALESCE(published_at, ?2)
             WHERE id = ?1 AND deleted_at IS NULL`,
          )
          .bind(id, now)
          .run();
        return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
      } catch (error) {
        // 題が空の版はトリガ note_published_revision_valid が拒む（FR-011）
        if (errorIncludes(error, 'note_published_revision_invalid')) {
          return { ok: false, reason: 'untitled' };
        }
        throw error;
      }
    },
  };
};
