import 'server-only';

import {
  summaryOf,
  type Note,
  type NoteCardImage,
  type NotePreview,
  type NoteRevisionSummary,
  type NoteStatus,
  type NoteSummary,
  type VisitorLinkPreview,
  type VisitorNote,
  type VisitorNoteCardImage,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import { readMarkdown } from '@/shared/domain/markdown';

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
  is_first_paragraph_as_description: 0 | 1;
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
  /** 画像と参照先の情報を引くためだけに読む。DTO に入れない */
  id: number;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  published_at: string;
  card_image: NoteCardImage;
  card_media_storage_key: string | null;
  is_first_paragraph_as_description: 0 | 1;
};

/** 見た目の確認で読む行。一度も公開していない note は初めて公開した日時を持たない */
type PreviewRow = Omit<VisitorRow, 'published_at'> & { published_at: string | null };

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
  // 外部キーと CHECK が media の行を持たない `media` を許さない。読めなければサイト共通の画像に倒す
  return { kind: 'site' };
};

type LinkPreviewRow = { url: string; title: string | null; image_url: string | null };

/** 読んだ参照先の情報を、渡した URL の順に並べる。取ったことのない URL は外す */
const toLinkPreviews = (urls: string[], rows: LinkPreviewRow[]): VisitorLinkPreview[] => {
  const byUrl = new Map(
    rows.map((row) => [row.url, { url: row.url, title: row.title, imageUrl: row.image_url }]),
  );
  return urls.flatMap((url) => byUrl.get(url) ?? []);
};

export const createD1NoteRepository = (db: D1Database): NoteRepository => {
  /** 無いか削除した note か */
  const isMissing = async (id: number) =>
    (await db
      .prepare('SELECT 1 AS found FROM note WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first()) === null;

  /**
   * 本文が指す画像と参照先の情報を読む（research.md の R11）。本文は共有担当の Markdown の部品で
   * 構文木にして読む。画像はその note の `media` の行にあるキーだけを、本文に現れた順で返す
   */
  const readBodyReferences = async (noteId: number, body: string) => {
    const { mediaKeys, urlLines, firstParagraph } = readMarkdown(body);
    const [mediaResult, previewResult] = await db.batch<{ storage_key: string } | LinkPreviewRow>([
      db
        .prepare(
          `SELECT storage_key FROM media
           WHERE note_id = ? AND storage_key IN (SELECT value FROM json_each(?))`,
        )
        .bind(noteId, JSON.stringify(mediaKeys)),
      linkPreviewsOf(urlLines),
    ]);
    const owned = new Set(
      (mediaResult.results as { storage_key: string }[]).map((r) => r.storage_key),
    );
    return {
      media: mediaKeys.filter((key) => owned.has(key)),
      linkPreviews: toLinkPreviews(urlLines, previewResult.results as LinkPreviewRow[]),
      firstParagraph,
    };
  };

  /** 参照先の情報を URL の並びで読む文。URL ごとに 1 行（`link_preview.url` の UNIQUE） */
  const linkPreviewsOf = (urls: string[]) =>
    db
      .prepare(
        `SELECT url, title, image_url FROM link_preview
         WHERE url IN (SELECT value FROM json_each(?))`,
      )
      .bind(JSON.stringify(urls));

  /** 版の行を訪問者向けの形に詰める。公開した版（訪問者）と最も新しい版（見た目の確認）が使う */
  const toNotePreview = async (row: PreviewRow): Promise<NotePreview> => {
    const { media, linkPreviews, firstParagraph } = await readBodyReferences(row.id, row.body);
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      summary: summaryOf(
        { description: row.description, firstParagraph },
        row.is_first_paragraph_as_description === 1,
      ),
      body: row.body,
      publishedAt: row.published_at,
      cardImage: toCardImage(row.card_image, row.card_media_storage_key),
      media,
      linkPreviews,
    };
  };

  return {
    findVisitorBySlug: async (slug) => {
      const row = await db
        .prepare(
          `SELECT n.id, n.slug, r.title, r.description, r.body, n.published_at, n.card_image,
             m.storage_key AS card_media_storage_key, n.is_first_paragraph_as_description
           ${VISITOR_FROM}`,
        )
        .bind(slug)
        .first<VisitorRow>();
      if (!row) return null;
      const dto: VisitorNote = { ...(await toNotePreview(row)), publishedAt: row.published_at };
      return dto;
    },

    findPreview: async (id) => {
      // 最も新しい版を、状態と削除に関わらず読む（research.md の R15）。オーナーだけが呼ぶ
      const row = await db
        .prepare(
          `SELECT n.id, n.slug, r.title, r.description, r.body, n.published_at, n.card_image,
             m.storage_key AS card_media_storage_key, n.is_first_paragraph_as_description
           FROM note n
           JOIN note_revision r
             ON r.id = (SELECT max(id) FROM note_revision WHERE note_id = n.id)
           LEFT JOIN media m ON m.id = n.card_media_id AND m.note_id = n.id
           WHERE n.id = ?`,
        )
        .bind(id)
        .first<PreviewRow>();
      return row ? toNotePreview(row) : null;
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
               m.storage_key AS card_media_storage_key, n.is_first_paragraph_as_description,
               pr.uid AS published_revision_uid
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
        isFirstParagraphAsDescription: row.is_first_paragraph_as_description === 1,
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

    unpublish: async (id) => {
      const result = await db
        .prepare(
          "UPDATE note SET status = 'draft' WHERE id = ? AND status = 'published' AND deleted_at IS NULL",
        )
        .bind(id)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    delete: async (id, now) => {
      const result = await db
        .prepare('UPDATE note SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(now, id)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    restore: async (id) => {
      const result = await db
        .prepare('UPDATE note SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL')
        .bind(id)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    listRevisions: async (id) => {
      const { results } = await db
        .prepare(
          `SELECT r.uid, r.title, r.created_at,
             r.id = (SELECT max(id) FROM note_revision WHERE note_id = r.note_id) AS is_latest,
             r.id IS (SELECT published_revision_id FROM note WHERE id = r.note_id) AS is_published
           FROM note_revision r WHERE r.note_id = ? ORDER BY r.id DESC`,
        )
        .bind(id)
        .all<{
          uid: string;
          title: string;
          created_at: string;
          is_latest: 0 | 1;
          is_published: 0 | 1;
        }>();
      return results.map((row): NoteRevisionSummary => ({
        uid: row.uid,
        title: row.title,
        createdAt: row.created_at,
        isLatest: row.is_latest === 1,
        isPublished: row.is_published === 1,
      }));
    },

    findRevision: async (id, revisionUid) => {
      const row = await db
        .prepare(
          `SELECT uid, title, description, body, created_at FROM note_revision
           WHERE note_id = ? AND uid = ?`,
        )
        .bind(id, revisionUid)
        .first<RevisionRow>();
      return row ? toRevision(row) : null;
    },

    revert: async (id, revisionUid, openedRevisionUid) => {
      // 戻す版の中身を、保存と同じ条件で新しい版として写す。版は書き換えない（FR-006・FR-009）
      const result = await db
        .prepare(
          `INSERT INTO note_revision (note_id, title, description, body)
           SELECT note_id, title, description, body FROM note_revision
           WHERE note_id = ? AND uid = ? AND ${WRITABLE}`,
        )
        .bind(id, revisionUid, id, openedRevisionUid, id)
        .run();
      if (result.meta.changes > 0) return { ok: true };
      if (await isMissing(id)) return { ok: false, reason: 'not-found' };
      const revision = await db
        .prepare('SELECT 1 AS found FROM note_revision WHERE note_id = ? AND uid = ?')
        .bind(id, revisionUid)
        .first();
      return { ok: false, reason: revision === null ? 'revision-not-found' : 'conflict' };
    },

    findMissingRevision: async (uid, revisionUid) => {
      const row = await db
        .prepare(
          `SELECT EXISTS (SELECT 1 FROM note_revision r WHERE r.note_id = n.id AND r.uid = ?)
             AS has_revision
           FROM note n WHERE n.uid = ?`,
        )
        .bind(revisionUid, uid)
        .first<{ has_revision: 0 | 1 }>();
      if (!row) return 'note';
      return row.has_revision === 1 ? null : 'revision';
    },

    addSyndication: async (id, url) => {
      try {
        const result = await db
          .prepare(
            `INSERT INTO syndication (note_id, url)
             SELECT id, ? FROM note WHERE id = ? AND deleted_at IS NULL`,
          )
          .bind(url, id)
          .run();
        return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
      } catch (error) {
        if (errorIncludes(error, 'UNIQUE constraint failed: syndication.url')) {
          return { ok: false, reason: 'url-taken' };
        }
        throw error;
      }
    },

    removeSyndication: async (id, url) => {
      const result = await db
        .prepare(
          `DELETE FROM syndication WHERE note_id = ? AND url = ?
             AND EXISTS (SELECT 1 FROM note WHERE note.id = syndication.note_id AND deleted_at IS NULL)`,
        )
        .bind(id, url)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    changeCardImage: async (id, cardImage) => {
      const result =
        cardImage.kind === 'media'
          ? await db
              .prepare(
                `UPDATE note SET card_image = 'media',
                   card_media_id = (SELECT id FROM media WHERE note_id = ?1 AND storage_key = ?2)
                 WHERE id = ?1 AND deleted_at IS NULL
                   AND EXISTS (SELECT 1 FROM media WHERE note_id = ?1 AND storage_key = ?2)`,
              )
              .bind(id, cardImage.storageKey)
              .run()
          : await db
              .prepare(
                'UPDATE note SET card_image = ?, card_media_id = NULL WHERE id = ? AND deleted_at IS NULL',
              )
              .bind(cardImage.kind, id)
              .run();
      if (result.meta.changes > 0) return { ok: true };
      return { ok: false, reason: (await isMissing(id)) ? 'not-found' : 'media-not-owned' };
    },

    changeFirstParagraphAsDescription: async (id, isFirstParagraphAsDescription) => {
      const result = await db
        .prepare(
          'UPDATE note SET is_first_paragraph_as_description = ? WHERE id = ? AND deleted_at IS NULL',
        )
        .bind(isFirstParagraphAsDescription ? 1 : 0, id)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    addMedia: async (id, storageKey) => {
      const result = await db
        .prepare(
          `INSERT INTO media (note_id, storage_key)
           SELECT id, ? FROM note WHERE id = ? AND deleted_at IS NULL`,
        )
        .bind(storageKey, id)
        .run();
      return { ok: result.meta.changes > 0 };
    },

    purge: async (id) => {
      // note から版と画像を指す外部キーの検査はトランザクションの終わりに送られる（migrations/0005
      // の冒頭）ため、指す先を空にせずにこの順で消せる。公開したことのある note の
      // published_revision_id は CHECK とトリガが空にさせない（research.md の R6）。消す画像の
      // キーは、同じ batch() の最初の文で読む
      const [mediaResult, , , , noteResult] = await db.batch<{ storage_key: string }>([
        db.prepare('SELECT storage_key FROM media WHERE note_id = ? ORDER BY id').bind(id),
        db.prepare('DELETE FROM media WHERE note_id = ?').bind(id),
        db.prepare('DELETE FROM syndication WHERE note_id = ?').bind(id),
        db.prepare('DELETE FROM note_revision WHERE note_id = ?').bind(id),
        db.prepare('DELETE FROM note WHERE id = ?').bind(id),
      ]);
      if ((noteResult?.meta.changes ?? 0) === 0) return { ok: false };
      return {
        ok: true,
        storageKeys: (mediaResult?.results ?? []).map((row) => row.storage_key),
      };
    },

    findLinkPreviews: async (urls) => {
      const { results } = await linkPreviewsOf(urls).all<LinkPreviewRow>();
      return toLinkPreviews(urls, results);
    },

    saveLinkPreview: async ({ url, title, imageUrl, fetchedAt }) => {
      // URL ごとに 1 行。取り直すと同じ行を書き換え、その URL を書いたすべての note が読む（FR-029）。
      // 訪問者向けの取り出しは本文の URL を `URL` の形に揃えて引くため、同じ形で書く。遅れて
      // 終わった前の取得では、後の取得の中身を書き換えない
      await db
        .prepare(
          `INSERT INTO link_preview (url, title, image_url, fetched_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (url) DO UPDATE SET
             title = excluded.title, image_url = excluded.image_url, fetched_at = excluded.fetched_at
           WHERE excluded.fetched_at >= link_preview.fetched_at`,
        )
        .bind(new URL(url).href, title, imageUrl, fetchedAt)
        .run();
    },
  };
};
