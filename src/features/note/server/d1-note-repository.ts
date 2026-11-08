import 'server-only';

import type {
  CardImageSource,
  LinkPreview,
  NoteForEdit,
  NoteRevision,
  NoteStatus,
  NoteSummary,
  VisitorNote,
} from '@/features/note/domain/note';
import { IMAGE_MAX_COUNT, MEDIA_SCHEME, toImageFile } from '@/shared/domain/media-image';
import type { NoteRepository, NoteWriteFailure } from '@/features/note/domain/note-repository';

/**
 * `NoteRepository` の D1 の実装。行の型はこのファイルの中だけに置き、domain の型に詰め替える。
 * 列・CHECK・トリガの正本は migrations/0005 と 0015 にある。複数の文は 1 つの `batch()`
 * （1 つのトランザクション）で送る（specs/003-note/research.md の R2）
 */

type RevisionRow = {
  number: number;
  title: string;
  description: string | null;
  body: string;
  created_at: string;
};

type EditRow = {
  id: number;
  uid: string;
  slug: string;
  status: NoteStatus;
  deleted_at: string | null;
  published_at: string | null;
  published_number: number | null;
  card_image: CardImageSource;
  card_key: string | null;
  latest_number: number;
  title: string;
  description: string | null;
  body: string;
  revision_created_at: string;
};

type SummaryRow = {
  id: number;
  uid: string;
  slug: string;
  status: NoteStatus;
  deleted_at: string | null;
  title: string;
  latest_number: number;
  published_number: number | null;
};

/** 公開した版だけの列。最新の版と下書きの列を持たない（contracts/visitor-note.md） */
type VisitorRow = {
  slug: string;
  title: string;
  description: string | null;
  body: string;
  published_at: string;
  card_image: CardImageSource;
  card_key: string | null;
};

/** 訪問者に出してよい note の条件（data-model.md の「アプリケーションが守る決まり」） */
const VISITOR_VISIBLE = "n.status = 'published' AND n.deleted_at IS NULL";

/** note の版の数。最新の版の番号と同じ（research.md の R4） */
const REVISION_COUNT = '(SELECT count(*) FROM note_revision WHERE note_id = ?)';

/** その note の最新の版の id */
const LATEST_REVISION_ID = '(SELECT max(id) FROM note_revision WHERE note_id = n.id)';

/** 公開した版の番号。一度も公開していなければ NULL */
const PUBLISHED_NUMBER = `CASE WHEN n.published_revision_id IS NULL THEN NULL ELSE
  (SELECT count(*) FROM note_revision WHERE note_id = n.id AND id <= n.published_revision_id) END`;

const errorIncludes = (error: unknown, text: string) =>
  error instanceof Error && error.message.includes(text);

const toRevision = (row: RevisionRow): NoteRevision => ({
  number: row.number,
  title: row.title,
  description: row.description,
  body: row.body,
  createdAt: row.created_at,
});

/** D1 の `bind()` は 1 文に 100 個まで。URL を分けて問い合わせる */
const BIND_CHUNK = 90;

export const createD1NoteRepository = (db: D1Database): NoteRepository => {
  /**
   * 書き込みが当たらなかった理由を見分ける。行が無ければ消されていた。削除の印があれば削除した
   * note。どちらでもなければ、ほかの理由（`otherwise`）
   */
  const whyMissed = async <R extends NoteWriteFailure>(
    id: number,
    otherwise: R,
  ): Promise<{ ok: false; reason: R | 'deleted' | 'not-found' }> => {
    const row = await db
      .prepare('SELECT deleted_at FROM note WHERE id = ?')
      .bind(id)
      .first<{ deleted_at: string | null }>();
    if (!row) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: row.deleted_at === null ? otherwise : 'deleted' };
  };

  const exists = async (id: number) =>
    (await db.prepare('SELECT 1 AS found FROM note WHERE id = ?').bind(id).first()) !== null;

  /** 削除していない note の条件。書き込みの文の WHERE に足す */
  const LIVE = 'EXISTS (SELECT 1 FROM note WHERE id = ? AND deleted_at IS NULL)';

  return {
    list: async () => {
      const { results } = await db
        .prepare(
          `SELECT n.id, n.uid, n.slug, n.status, n.deleted_at, r.title,
             (SELECT count(*) FROM note_revision WHERE note_id = n.id) AS latest_number,
             ${PUBLISHED_NUMBER} AS published_number
           FROM note n JOIN note_revision r ON r.id = ${LATEST_REVISION_ID}
           ORDER BY n.created_at DESC, n.id DESC`,
        )
        .all<SummaryRow>();
      return results.map((row): NoteSummary => ({
        id: row.id,
        uid: row.uid,
        slug: row.slug,
        title: row.title,
        status: row.status,
        isDeleted: row.deleted_at !== null,
        latestRevisionNumber: row.latest_number,
        publishedRevisionNumber: row.published_number,
      }));
    },

    findForEdit: async (id) => {
      const [note, media, syndications] = await db.batch<
        EditRow | { storage_key: string } | { url: string }
      >([
        db
          .prepare(
            `SELECT n.id, n.uid, n.slug, n.status, n.deleted_at, n.published_at,
               ${PUBLISHED_NUMBER} AS published_number, n.card_image, cm.storage_key AS card_key,
               (SELECT count(*) FROM note_revision WHERE note_id = n.id) AS latest_number,
               r.title, r.description, r.body, r.created_at AS revision_created_at
             FROM note n
             JOIN note_revision r ON r.id = ${LATEST_REVISION_ID}
             LEFT JOIN media cm ON cm.id = n.card_media_id
             WHERE n.id = ?`,
          )
          .bind(id),
        db.prepare('SELECT storage_key FROM media WHERE note_id = ? ORDER BY id').bind(id),
        db.prepare('SELECT url FROM syndication WHERE note_id = ? ORDER BY id').bind(id),
      ]);
      const row = note.results[0] as EditRow | undefined;
      if (!row) return null;
      const result: NoteForEdit = {
        id: row.id,
        uid: row.uid,
        slug: row.slug,
        status: row.status,
        isDeleted: row.deleted_at !== null,
        publishedAt: row.published_at,
        publishedRevisionNumber: row.published_number,
        latest: {
          number: row.latest_number,
          title: row.title,
          description: row.description,
          body: row.body,
          createdAt: row.revision_created_at,
        },
        cardImage: {
          source: row.card_image,
          file: row.card_key === null ? null : toImageFile(row.card_key),
        },
        images: (media.results as { storage_key: string }[]).map((m) => ({
          file: toImageFile(m.storage_key),
        })),
        syndications: (syndications.results as { url: string }[]).map((s) => s.url),
      };
      return result;
    },

    findIdByUid: async (uid) =>
      (await db.prepare('SELECT id FROM note WHERE uid = ?').bind(uid).first<{ id: number }>())
        ?.id ?? null,

    listRevisions: async (id) => {
      const { results } = await db
        .prepare(
          `SELECT ROW_NUMBER() OVER (ORDER BY id) AS number, title, description, body, created_at
           FROM note_revision WHERE note_id = ? ORDER BY id DESC`,
        )
        .bind(id)
        .all<RevisionRow>();
      return results.map(toRevision);
    },

    findRevision: async (id, number) => {
      const row = await db
        .prepare(
          `SELECT number, title, description, body, created_at FROM (
             SELECT ROW_NUMBER() OVER (ORDER BY id) AS number, title, description, body, created_at
             FROM note_revision WHERE note_id = ?
           ) WHERE number = ?`,
        )
        .bind(id, number)
        .first<RevisionRow>();
      return row ? toRevision(row) : null;
    },

    hasRevision: async (id, number) =>
      (await db
        .prepare(`SELECT 1 AS found FROM note WHERE id = ? AND ${REVISION_COUNT} >= ?`)
        .bind(id, id, number)
        .first()) !== null,

    create: async (slug, content) => {
      try {
        const [note] = await db.batch<{ id: number; uid: string }>([
          db.prepare('INSERT INTO note (slug) VALUES (?) RETURNING id, uid').bind(slug),
          db
            .prepare(
              `INSERT INTO note_revision (note_id, title, description, body)
               SELECT id, ?, ?, ? FROM note WHERE slug = ?`,
            )
            .bind(content.title, content.description, content.body, slug),
        ]);
        const row = note.results[0];
        return { ok: true, id: row.id, uid: row.uid };
      } catch (error) {
        if (errorIncludes(error, 'UNIQUE constraint failed: note.slug')) {
          return { ok: false, reason: 'slug-taken' };
        }
        throw error;
      }
    },

    save: async (id, slug, content, openedRevision) => {
      // 識別子と版は、最新の版の番号が開いたときと一致し、削除していないときだけ書く。
      // 識別子を先に書いても版の数は変わらないため、版の条件は同じ値で比べられる
      const opened = `id = ? AND deleted_at IS NULL AND ${REVISION_COUNT} = ?`;
      let changes: number;
      try {
        const results = await db.batch([
          db
            .prepare(`UPDATE note SET slug = ? WHERE ${opened} AND slug IS NOT ?`)
            .bind(slug, id, id, openedRevision, slug),
          db
            .prepare(
              `INSERT INTO note_revision (note_id, title, description, body)
               SELECT id, ?, ?, ? FROM note WHERE ${opened}`,
            )
            .bind(content.title, content.description, content.body, id, id, openedRevision),
        ]);
        changes = results[1]?.meta.changes ?? 0;
      } catch (error) {
        if (errorIncludes(error, 'UNIQUE constraint failed: note.slug')) {
          return { ok: false, reason: 'slug-taken' };
        }
        if (errorIncludes(error, 'note_slug_fixed_after_publication')) {
          return { ok: false, reason: 'slug-locked' };
        }
        throw error;
      }
      if (changes > 0) return { ok: true, revision: openedRevision + 1 };
      return whyMissed(id, 'conflict');
    },

    publish: async (id, openedRevision, now) => {
      let changes: number;
      try {
        const result = await db
          .prepare(
            `UPDATE note SET status = 'published',
               published_revision_id = (SELECT max(id) FROM note_revision WHERE note_id = ?),
               published_at = COALESCE(published_at, ?)
             WHERE id = ? AND deleted_at IS NULL AND ${REVISION_COUNT} = ?`,
          )
          .bind(id, now, id, id, openedRevision)
          .run();
        changes = result.meta.changes;
      } catch (error) {
        if (errorIncludes(error, 'note_published_revision_invalid')) {
          return { ok: false, reason: 'empty-title' };
        }
        throw error;
      }
      return changes > 0 ? { ok: true } : whyMissed(id, 'conflict');
    },

    unpublish: async (id) => {
      const result = await db
        .prepare("UPDATE note SET status = 'draft' WHERE id = ? AND deleted_at IS NULL")
        .bind(id)
        .run();
      return result.meta.changes > 0 ? { ok: true } : whyMissed(id, 'deleted');
    },

    delete: async (id, now) => {
      await db
        .prepare('UPDATE note SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(now, id)
        .run();
      return (await exists(id)) ? { ok: true } : { ok: false, reason: 'not-found' };
    },

    undelete: async (id) => {
      const result = await db
        .prepare('UPDATE note SET deleted_at = NULL WHERE id = ?')
        .bind(id)
        .run();
      return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
    },

    purge: async (id) => {
      const { results } = await db
        .prepare('SELECT storage_key FROM media WHERE note_id = ?')
        .bind(id)
        .all<{ storage_key: string }>();
      // note から版と画像を指す外部キーは、検査をトランザクションの終わりに送る（migration 0005）。
      // 子の行を先に消し、最後に note を消す。参照先の情報は note に属さないため消さない（FR-017）
      const deleted = await db.batch([
        db.prepare('DELETE FROM syndication WHERE note_id = ?').bind(id),
        db.prepare('DELETE FROM media WHERE note_id = ?').bind(id),
        db.prepare('DELETE FROM note_revision WHERE note_id = ?').bind(id),
        db.prepare('DELETE FROM note WHERE id = ?').bind(id),
      ]);
      return (deleted.at(-1)?.meta.changes ?? 0) > 0
        ? { ok: true, storageKeys: results.map((row) => row.storage_key) }
        : { ok: false, reason: 'not-found' };
    },

    addImage: async (id, storageKey) => {
      const result = await db
        .prepare(
          `INSERT INTO media (note_id, storage_key) SELECT ?, ?
           WHERE ${LIVE} AND (SELECT count(*) FROM media WHERE note_id = ?) < ?`,
        )
        .bind(id, storageKey, id, id, IMAGE_MAX_COUNT)
        .run();
      return result.meta.changes > 0 ? { ok: true } : whyMissed(id, 'too-many-images');
    },

    chooseCardImage: async (id, source, storageKey) => {
      const statement =
        source === 'media'
          ? db
              .prepare(
                `UPDATE note SET card_image = 'media',
                   card_media_id = (SELECT id FROM media WHERE note_id = ? AND storage_key = ?)
                 WHERE id = ? AND deleted_at IS NULL
                   AND EXISTS (SELECT 1 FROM media WHERE note_id = ? AND storage_key = ?)`,
              )
              .bind(id, storageKey, id, id, storageKey)
          : db
              .prepare(
                `UPDATE note SET card_image = ?, card_media_id = NULL
                 WHERE id = ? AND deleted_at IS NULL`,
              )
              .bind(source, id);
      const result = await statement.run();
      return result.meta.changes > 0 ? { ok: true } : whyMissed(id, 'not-own-image');
    },

    findOwnerImage: async (id, storageKey) =>
      (
        await db
          .prepare('SELECT storage_key FROM media WHERE note_id = ? AND storage_key = ?')
          .bind(id, storageKey)
          .first<{ storage_key: string }>()
      )?.storage_key ?? null,

    addSyndication: async (id, url) => {
      try {
        const result = await db
          .prepare(`INSERT INTO syndication (note_id, url) SELECT ?, ? WHERE ${LIVE}`)
          .bind(id, url, id)
          .run();
        return result.meta.changes > 0 ? { ok: true } : whyMissed(id, 'deleted');
      } catch (error) {
        if (errorIncludes(error, 'UNIQUE constraint failed: syndication.url')) {
          return { ok: false, reason: 'syndication-taken' };
        }
        throw error;
      }
    },

    removeSyndication: async (id, url) => {
      if (!(await exists(id))) return { ok: false, reason: 'not-found' };
      const result = await db
        .prepare(`DELETE FROM syndication WHERE note_id = ? AND url = ? AND ${LIVE}`)
        .bind(id, url, id)
        .run();
      return result.meta.changes > 0 ? { ok: true } : whyMissed(id, 'deleted');
    },

    findLinkPreviews: async (urls) => {
      if (urls.length === 0) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < urls.length; i += BIND_CHUNK) chunks.push(urls.slice(i, i + BIND_CHUNK));
      const results = await db.batch<{
        url: string;
        title: string | null;
        image_url: string | null;
      }>(
        chunks.map((chunk) =>
          db
            .prepare(
              `SELECT url, title, image_url FROM link_preview
               WHERE url IN (${chunk.map(() => '?').join(', ')})`,
            )
            .bind(...chunk),
        ),
      );
      return results.flatMap((result) =>
        result.results.map((row): LinkPreview => ({
          url: row.url,
          title: row.title,
          imageUrl: row.image_url,
        })),
      );
    },

    saveLinkPreviews: async (previews, fetchedAt) => {
      if (previews.length === 0) return;
      await db.batch(
        previews.map((preview) =>
          db
            .prepare(
              `INSERT INTO link_preview (url, title, image_url, fetched_at) VALUES (?, ?, ?, ?)
               ON CONFLICT (url) DO UPDATE SET
                 title = excluded.title, image_url = excluded.image_url,
                 fetched_at = excluded.fetched_at`,
            )
            .bind(preview.url, preview.title, preview.imageUrl, fetchedAt),
        ),
      );
    },

    findVisitorBySlug: async (slug) => {
      const row = await db
        .prepare(
          `SELECT n.slug, r.title, r.description, r.body, n.published_at, n.card_image,
             cm.storage_key AS card_key
           FROM note n
           JOIN note_revision r ON r.id = n.published_revision_id
           LEFT JOIN media cm ON cm.id = n.card_media_id
           WHERE n.slug = ? AND ${VISITOR_VISIBLE}`,
        )
        .bind(slug)
        .first<VisitorRow>();
      if (!row) return null;
      const note: VisitorNote = {
        slug: row.slug,
        title: row.title,
        description: row.description,
        body: row.body,
        publishedAt: row.published_at,
        cardImage: {
          source: row.card_image,
          file: row.card_key === null ? null : toImageFile(row.card_key),
        },
        linkPreviews: {},
      };
      return note;
    },

    hasVisitorSlug: async (slug) =>
      (await db
        .prepare(`SELECT 1 AS found FROM note n WHERE n.slug = ? AND ${VISITOR_VISIBLE}`)
        .bind(slug)
        .first()) !== null,

    findVisitorImage: async (slug, storageKey) =>
      (
        await db
          .prepare(
            `SELECT m.storage_key FROM note n
             JOIN note_revision r ON r.id = n.published_revision_id
             JOIN media m ON m.note_id = n.id
             WHERE n.slug = ? AND ${VISITOR_VISIBLE} AND m.storage_key = ?
               AND (instr(r.body, ?) > 0 OR n.card_media_id = m.id)`,
          )
          .bind(slug, storageKey, `${MEDIA_SCHEME}${toImageFile(storageKey)}`)
          .first<{ storage_key: string }>()
      )?.storage_key ?? null,
  };
};
