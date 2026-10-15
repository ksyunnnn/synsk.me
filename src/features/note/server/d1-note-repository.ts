import 'server-only';

import type {
  DeletedNote,
  EditableNote,
  NoteContent,
  NoteId,
  NoteStatus,
  NoteSummary,
  PublishedNote,
} from '@/features/note/domain/note';
import type {
  CreateNoteResult,
  DeleteNoteResult,
  NoteRepository,
  RestoreNoteResult,
  UpdateNoteResult,
} from '@/features/note/domain/note-repository';

/**
 * `NoteRepository` の D1 の実装。D1 の API はこのファイルの中だけで使う（ADR-0035）。
 *
 * 表の形は `migrations/` にある。題と本文は `note_revision` に版として足し、
 * `note.published_revision_id` が最後に公開した版を指す。削除した note は
 * `note.deleted_at` に日時を持つ。戻す操作と削除した note の取り出しのほかは、
 * どの文も `deleted_at IS NULL` で絞る。
 */

/**
 * D1 が制約の違反を伝える文言。D1 は違反の種類をエラーの型で分けず、
 * `D1_ERROR: UNIQUE constraint failed: note.slug: SQLITE_CONSTRAINT` のような
 * 文言で返す。トリガの `RAISE` は、渡した文言がそのまま入る
 */
const SLUG_TAKEN_MESSAGE = 'UNIQUE constraint failed: note.slug';
const SLUG_FIXED_MESSAGE = 'note_slug_fixed_after_publication';

/** 制約の違反の種類。制約の違反でなければ null */
const toConstraintViolation = (error: unknown): 'slug-fixed' | 'slug-taken' | null => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes(SLUG_FIXED_MESSAGE)) return 'slug-fixed';
  if (message.includes(SLUG_TAKEN_MESSAGE)) return 'slug-taken';
  return null;
};

const toUpdateFailure = (error: unknown): UpdateNoteResult => {
  const reason = toConstraintViolation(error);
  if (reason === null) throw error;
  return { ok: false, reason };
};

/**
 * `note` の行の、最新の版の id を求める式。作り手が書き換えている内容は最新の版で、
 * 保存・公開・一覧のどれもこの式で最新の版を決める
 */
const LATEST_REVISION_ID = '(SELECT max(id) FROM note_revision WHERE note_id = note.id)';

/** note ごとの最新の版を、`latest` の名前で結ぶ */
const JOIN_LATEST_REVISION = `JOIN note_revision AS latest ON latest.id = ${LATEST_REVISION_ID}`;

type PublishedNoteRow = {
  slug: string;
  title: string;
  body: string;
  published_at: string;
};

type EditableNoteRow = {
  id: number;
  slug: string;
  title: string;
  body: string;
  status: NoteStatus;
  slug_fixed: 0 | 1;
};

type DeletedNoteRow = {
  id: number;
  slug: string;
  title: string;
  status: NoteStatus;
  has_been_published: 0 | 1;
};

const toDeletedNote = (row: DeletedNoteRow): DeletedNote => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  status: row.status,
  hasBeenPublished: row.has_been_published === 1,
});

type NoteSummaryRow = {
  id: number;
  slug: string;
  title: string;
  status: NoteStatus;
  has_unpublished_changes: 0 | 1;
};

export const createD1NoteRepository = (db: D1Database): NoteRepository => {
  const updateSlug = (id: NoteId, slug: string) =>
    db.prepare('UPDATE note SET slug = ? WHERE id = ? AND deleted_at IS NULL').bind(slug, id);

  /** 題と本文を版として足す。最新の版と同じなら足さない */
  const appendRevision = (id: NoteId, { title, body }: NoteContent, createdAt: string) =>
    db
      .prepare(
        `INSERT INTO note_revision (note_id, title, body, created_at)
         SELECT note.id, ?, ?, ? FROM note
         WHERE note.id = ? AND note.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM note_revision AS latest
             WHERE latest.id = ${LATEST_REVISION_ID}
               AND latest.title = ? AND latest.body = ?
           )`,
      )
      .bind(title, body, createdAt, id, title, body);

  return {
    async create({ slug, title, body }, createdAt): Promise<CreateNoteResult> {
      // note と最初の版を1つの batch にする。D1 は batch を1つのトランザクションとして
      // 行い、途中の文が失敗すると全体を巻き戻す。SQL の BEGIN は受け付けない
      try {
        const [created] = await db.batch<{ id: number }>([
          db.prepare('INSERT INTO note (slug) VALUES (?) RETURNING id').bind(slug),
          db
            .prepare(
              `INSERT INTO note_revision (note_id, title, body, created_at)
               SELECT id, ?, ?, ? FROM note WHERE slug = ?`,
            )
            .bind(title, body, createdAt, slug),
        ]);
        const row = created.results[0];
        if (!row) throw new Error('INSERT が id を返さなかった');
        return { ok: true, id: row.id };
      } catch (error) {
        // 作るときに起きうる違反は slug の重複だけ。公開後の slug の固定は note がまだないため起きない
        if (toConstraintViolation(error) === 'slug-taken')
          return { ok: false, reason: 'slug-taken' };
        throw error;
      }
    },

    async save(id, content, savedAt): Promise<UpdateNoteResult> {
      try {
        const [updated] = await db.batch([
          updateSlug(id, content.slug),
          appendRevision(id, content, savedAt),
        ]);
        return updated.meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
      } catch (error) {
        return toUpdateFailure(error);
      }
    },

    async publish(id, content, publishedAt): Promise<UpdateNoteResult> {
      try {
        const [updated] = await db.batch([
          updateSlug(id, content.slug),
          appendRevision(id, content, publishedAt),
          // 公開する版は、直前の文で足した版か、入力と同じ最新の版。初めて公開した
          // 日時は空のときだけ入れ、公開し直すときは変えない
          db
            .prepare(
              `UPDATE note SET
                 status = 'published',
                 published_revision_id = ${LATEST_REVISION_ID},
                 published_at = coalesce(published_at, ?)
               WHERE id = ? AND deleted_at IS NULL`,
            )
            .bind(publishedAt, id),
        ]);
        return updated.meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
      } catch (error) {
        return toUpdateFailure(error);
      }
    },

    async delete(id, deletedAt): Promise<DeleteNoteResult> {
      // 行を消さない。版も、最後に公開した版も残し、戻せるようにする
      const { meta } = await db
        .prepare('UPDATE note SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(deletedAt, id)
        .run();
      return meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
    },

    async restore(id, as): Promise<RestoreNoteResult> {
      // 公開で戻せるのは、公開したことのある note だけ。下書きで戻しても、最後に
      // 公開した版と初めて公開した日時は消さない
      const statement =
        as === 'published'
          ? db.prepare(
              `UPDATE note SET deleted_at = NULL, status = 'published'
               WHERE id = ? AND deleted_at IS NOT NULL AND published_revision_id IS NOT NULL`,
            )
          : db.prepare(
              `UPDATE note SET deleted_at = NULL, status = 'draft'
               WHERE id = ? AND deleted_at IS NOT NULL`,
            );
      const { meta } = await statement.bind(id).run();
      return meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
    },

    async findPublishedBySlug(slug): Promise<PublishedNote | null> {
      // 訪問者に返す題と本文は、公開した版だけから取る。最新の版（書き換えている
      // 内容）を SELECT しない（ADR-0029）
      const row = await db
        .prepare(
          `SELECT note.slug, published.title, published.body, note.published_at
           FROM note
           JOIN note_revision AS published ON published.id = note.published_revision_id
           WHERE note.slug = ? AND note.status = 'published' AND note.deleted_at IS NULL`,
        )
        .bind(slug)
        .first<PublishedNoteRow>();
      if (!row) return null;
      return {
        slug: row.slug,
        title: row.title,
        body: row.body,
        publishedAt: row.published_at,
      };
    },

    async findForEdit(id): Promise<EditableNote | null> {
      const row = await db
        .prepare(
          `SELECT note.id, note.slug, latest.title, latest.body, note.status,
                  note.published_at IS NOT NULL AS slug_fixed
           FROM note
           ${JOIN_LATEST_REVISION}
           WHERE note.id = ? AND note.deleted_at IS NULL`,
        )
        .bind(id)
        .first<EditableNoteRow>();
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        body: row.body,
        status: row.status,
        slugFixed: row.slug_fixed === 1,
      };
    },

    async listForAuthor(): Promise<NoteSummary[]> {
      // 新しく作った note を先に並べる
      const { results } = await db
        .prepare(
          `SELECT note.id, note.slug, latest.title, note.status,
                  (note.status = 'published'
                    AND (latest.title <> published.title
                      OR latest.body <> published.body)) AS has_unpublished_changes
           FROM note
           ${JOIN_LATEST_REVISION}
           LEFT JOIN note_revision AS published ON published.id = note.published_revision_id
           WHERE note.deleted_at IS NULL
           ORDER BY note.id DESC`,
        )
        .all<NoteSummaryRow>();
      return results.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        hasUnpublishedChanges: row.has_unpublished_changes === 1,
      }));
    },

    async findDeleted(id): Promise<DeletedNote | null> {
      const row = await db
        .prepare(
          `SELECT note.id, note.slug, latest.title, note.status,
                  note.published_at IS NOT NULL AS has_been_published
           FROM note
           ${JOIN_LATEST_REVISION}
           WHERE note.id = ? AND note.deleted_at IS NOT NULL`,
        )
        .bind(id)
        .first<DeletedNoteRow>();
      return row && toDeletedNote(row);
    },

    async listDeletedForAuthor(): Promise<DeletedNote[]> {
      // 後から削除した note を先に並べる
      const { results } = await db
        .prepare(
          `SELECT note.id, note.slug, latest.title, note.status,
                  note.published_at IS NOT NULL AS has_been_published
           FROM note
           ${JOIN_LATEST_REVISION}
           WHERE note.deleted_at IS NOT NULL
           ORDER BY note.deleted_at DESC, note.id DESC`,
        )
        .all<DeletedNoteRow>();
      return results.map(toDeletedNote);
    },

    // 有無だけを確かめる。FROM・JOIN・WHERE は対応する取り出しと同じにし、
    // 「ある」の判定を取り出しと一致させる
    async hasPublished(slug): Promise<boolean> {
      const row = await db
        .prepare(
          `SELECT 1 FROM note
           JOIN note_revision AS published ON published.id = note.published_revision_id
           WHERE note.slug = ? AND note.status = 'published' AND note.deleted_at IS NULL`,
        )
        .bind(slug)
        .first();
      return row !== null;
    },

    async hasEditable(id): Promise<boolean> {
      const row = await db
        .prepare(
          `SELECT 1 FROM note ${JOIN_LATEST_REVISION} WHERE note.id = ? AND note.deleted_at IS NULL`,
        )
        .bind(id)
        .first();
      return row !== null;
    },

    async hasDeleted(id): Promise<boolean> {
      const row = await db
        .prepare(
          `SELECT 1 FROM note ${JOIN_LATEST_REVISION} WHERE note.id = ? AND note.deleted_at IS NOT NULL`,
        )
        .bind(id)
        .first();
      return row !== null;
    },
  };
};
