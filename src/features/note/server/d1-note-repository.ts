import 'server-only';

import type {
  EditableNote,
  NoteContent,
  NoteId,
  NoteSummary,
  PublishedNote,
} from '@/features/note/domain/note';
import type {
  CreateNoteResult,
  DeleteNoteResult,
  NoteRepository,
  UpdateNoteResult,
} from '@/features/note/domain/note-repository';

/**
 * `NoteRepository` の D1 の実装。D1 の API はこのファイルの中だけで使う（ADR-0035）。
 *
 * 表の形は `migrations/0001_create_note.sql` にある。
 */

/**
 * D1 が制約の違反を伝える文言。D1 は違反の種類をエラーの型で分けず、
 * `D1_ERROR: UNIQUE constraint failed: note.slug: SQLITE_CONSTRAINT` のような
 * 文言で返す。トリガの `RAISE` は、渡した文言がそのまま入る
 */
const SLUG_TAKEN_MESSAGE = 'UNIQUE constraint failed: note.slug';
const SLUG_FIXED_MESSAGE = 'note_slug_fixed_after_publication';

const toUpdateFailure = (error: unknown): UpdateNoteResult => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes(SLUG_FIXED_MESSAGE)) return { ok: false, reason: 'slug-fixed' };
  if (message.includes(SLUG_TAKEN_MESSAGE)) return { ok: false, reason: 'slug-taken' };
  throw error;
};

type PublishedNoteRow = {
  slug: string;
  title: string;
  body: string;
  first_published_at: string;
};

type EditableNoteRow = {
  id: number;
  slug: string;
  title: string;
  body: string;
  published: 0 | 1;
};

type NoteSummaryRow = {
  id: number;
  slug: string;
  title: string;
  published: 0 | 1;
  has_unpublished_changes: 0 | 1;
};

export const createD1NoteRepository = (db: D1Database): NoteRepository => {
  const updateNote = (id: NoteId, { slug, title, body }: NoteContent) =>
    db
      .prepare('UPDATE note SET slug = ?, title = ?, body = ? WHERE id = ?')
      .bind(slug, title, body, id);

  return {
    async create({ slug, title, body }): Promise<CreateNoteResult> {
      try {
        const row = await db
          .prepare('INSERT INTO note (slug, title, body) VALUES (?, ?, ?) RETURNING id')
          .bind(slug, title, body)
          .first<{ id: number }>();
        if (!row) throw new Error('INSERT が id を返さなかった');
        return { ok: true, id: row.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes(SLUG_TAKEN_MESSAGE)) return { ok: false, reason: 'slug-taken' };
        throw error;
      }
    },

    async save(id, content): Promise<UpdateNoteResult> {
      try {
        const { meta } = await updateNote(id, content).run();
        return meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
      } catch (error) {
        return toUpdateFailure(error);
      }
    },

    async publish(id, content, publishedAt): Promise<UpdateNoteResult> {
      // 保存と写しを1つの batch にする。D1 は batch を1つのトランザクションとして
      // 行い、途中の文が失敗すると全体を巻き戻す。SQL の BEGIN は受け付けない
      try {
        const [saved] = await db.batch([
          updateNote(id, content),
          // 写す値は、直前の文で保存した note の行から取る。初めて公開した日時は
          // 行を作るときだけ入れ、公開し直すときは変えない
          db
            .prepare(
              `INSERT INTO note_publication (note_id, title, body, first_published_at)
               SELECT id, title, body, ? FROM note WHERE id = ?
               ON CONFLICT (note_id) DO UPDATE SET title = excluded.title, body = excluded.body`,
            )
            .bind(publishedAt, id),
        ]);
        return saved.meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
      } catch (error) {
        return toUpdateFailure(error);
      }
    },

    async delete(id): Promise<DeleteNoteResult> {
      // note_publication の行は、外部キーの ON DELETE CASCADE で一緒に消える
      const { meta } = await db.prepare('DELETE FROM note WHERE id = ?').bind(id).run();
      return meta.changes === 0 ? { ok: false, reason: 'not-found' } : { ok: true };
    },

    async findPublishedBySlug(slug): Promise<PublishedNote | null> {
      // 訪問者に返す値は note_publication の列だけから取る。note の title と body
      // （書き換えている内容）を SELECT しない（ADR-0029）
      const row = await db
        .prepare(
          `SELECT note.slug, note_publication.title, note_publication.body,
                  note_publication.first_published_at
           FROM note_publication
           JOIN note ON note.id = note_publication.note_id
           WHERE note.slug = ?`,
        )
        .bind(slug)
        .first<PublishedNoteRow>();
      if (!row) return null;
      return {
        slug: row.slug,
        title: row.title,
        body: row.body,
        firstPublishedAt: row.first_published_at,
      };
    },

    async findForEdit(id): Promise<EditableNote | null> {
      const row = await db
        .prepare(
          `SELECT note.id, note.slug, note.title, note.body,
                  note_publication.note_id IS NOT NULL AS published
           FROM note
           LEFT JOIN note_publication ON note_publication.note_id = note.id
           WHERE note.id = ?`,
        )
        .bind(id)
        .first<EditableNoteRow>();
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        body: row.body,
        status: row.published ? 'published' : 'draft',
      };
    },

    async listForAuthor(): Promise<NoteSummary[]> {
      // 新しく作った note を先に並べる
      const { results } = await db
        .prepare(
          `SELECT note.id, note.slug, note.title,
                  note_publication.note_id IS NOT NULL AS published,
                  (note_publication.note_id IS NOT NULL
                    AND (note_publication.title <> note.title
                      OR note_publication.body <> note.body)) AS has_unpublished_changes
           FROM note
           LEFT JOIN note_publication ON note_publication.note_id = note.id
           ORDER BY note.id DESC`,
        )
        .all<NoteSummaryRow>();
      return results.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.published ? 'published' : 'draft',
        hasUnpublishedChanges: row.has_unpublished_changes === 1,
      }));
    },
  };
};
