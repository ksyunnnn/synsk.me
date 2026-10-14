import { access } from 'node:fs/promises';
import { createTestHarness } from 'wrangler';
import {
  TEST_ACCESS_AUD,
  TEST_OWNER_EMAIL,
  createAccessTestKeys,
  signAccessJwt,
  startAccessCertsServer,
} from '../../support/access';

/**
 * note の経路を結合テストするための土台。
 *
 * 本番のビルド出力を `createTestHarness()` で起動し、D1 に `migrations/` を当てて
 * note を入れる。JWT の検証の設定値 `ACCESS_*` は、テストが起動する公開鍵の
 * サーバへ向けて secret として渡す。本番のコードに試験用の分岐を持たせない
 * （specs/005-note-write-and-read/research.md の R6）。
 */

const CONFIG = './dist/server/wrangler.json';

/** 入れておく note。応答にどの値が出て、どの値が出ないかを確かめるために使う */
export const SEEDED_NOTES = {
  /** 公開済み。書き換えている内容と公開している内容が同じ */
  published: {
    id: 1,
    slug: 'published-note',
    title: '公開済みの題',
    // 改行が保たれることと、HTML の文字列が文字のまま出ることを確かめる
    body: '1行目の本文\n2行目の本文\n<script>alert("note")</script>',
    firstPublishedAt: '2026-09-16T15:30:00.000Z',
  },
  /** 公開済みで、公開し直していない書き換えがある */
  publishedWithChanges: {
    id: 2,
    slug: 'published-with-changes',
    title: '公開している題',
    body: '公開している本文',
    draftTitle: '公開し直していない題',
    draftBody: '公開し直していない本文',
    firstPublishedAt: '2026-09-10T00:00:00.000Z',
  },
  /** 下書き */
  draft: {
    id: 3,
    slug: 'draft-note',
    title: '下書きの題',
    body: '下書きの本文',
  },
  /** 公開済みのまま削除した */
  deleted: {
    id: 4,
    slug: 'deleted-note',
    title: '削除した題',
    body: '削除した本文',
    firstPublishedAt: '2026-09-12T00:00:00.000Z',
    deletedAt: '2026-10-01T03:00:00.000Z',
  },
} as const;

export type NoteRow = {
  id: number;
  slug: string;
  status: 'draft' | 'published';
  published_revision_id: number | null;
  published_at: string | null;
  deleted_at: string | null;
};
export type NoteRevisionRow = {
  id: number;
  note_id: number;
  title: string;
  body: string;
  created_at: string;
};

/** 版を作った日時。入れておく note の版は、どれもこの日時に作ったことにする */
const SEEDED_REVISION_CREATED_AT = '2026-09-01T00:00:00.000Z';

const seed = async (db: D1Database) => {
  const { published, publishedWithChanges, draft, deleted } = SEEDED_NOTES;
  const insertNote = (id: number, slug: string) =>
    db.prepare('INSERT INTO note (id, slug) VALUES (?, ?)').bind(id, slug);
  const insertRevision = (id: number, noteId: number, title: string, body: string) =>
    db
      .prepare(
        'INSERT INTO note_revision (id, note_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(id, noteId, title, body, SEEDED_REVISION_CREATED_AT);
  const publish = (noteId: number, revisionId: number, at: string) =>
    db
      .prepare(
        "UPDATE note SET status = 'published', published_revision_id = ?, published_at = ? WHERE id = ?",
      )
      .bind(revisionId, at, noteId);

  await db.batch([
    insertNote(published.id, published.slug),
    insertRevision(1, published.id, published.title, published.body),
    publish(published.id, 1, published.firstPublishedAt),
    insertNote(publishedWithChanges.id, publishedWithChanges.slug),
    insertRevision(
      2,
      publishedWithChanges.id,
      publishedWithChanges.title,
      publishedWithChanges.body,
    ),
    publish(publishedWithChanges.id, 2, publishedWithChanges.firstPublishedAt),
    // 公開した後に保存した、公開し直していない版
    insertRevision(
      3,
      publishedWithChanges.id,
      publishedWithChanges.draftTitle,
      publishedWithChanges.draftBody,
    ),
    insertNote(draft.id, draft.slug),
    insertRevision(4, draft.id, draft.title, draft.body),
    insertNote(deleted.id, deleted.slug),
    insertRevision(5, deleted.id, deleted.title, deleted.body),
    publish(deleted.id, 5, deleted.firstPublishedAt),
    db.prepare('UPDATE note SET deleted_at = ? WHERE id = ?').bind(deleted.deletedAt, deleted.id),
  ]);
};

export type NoteTestServer = {
  server: ReturnType<typeof createTestHarness>;
  /** Worker が使うものと同じ D1。行を入れ、読み、表を消して読めない状態を作るのに使う */
  db: D1Database;
  /** 作り手の JWT。`Cf-Access-Jwt-Assertion` に入れる */
  signAuthorJwt: (claims?: { audience?: string; email?: string }) => Promise<string>;
  close: () => Promise<void>;
};

/**
 * ビルド出力を起動し、マイグレーションを当てて note を入れる。
 * `seedNotes: false` なら、マイグレーションだけを当てて note を入れない
 */
export const startNoteTestServer = async ({
  seedNotes = true,
}: { seedNotes?: boolean } = {}): Promise<NoteTestServer> => {
  await access(CONFIG).catch(() => {
    throw new Error(
      `${CONFIG} がない。結合テストはビルドを前提とする。npm run test:integration を使う`,
    );
  });

  const keys = await createAccessTestKeys();
  const certs = await startAccessCertsServer(keys.publicJwk);
  const server = createTestHarness({
    workers: [
      {
        configPath: CONFIG,
        secrets: {
          ACCESS_ISSUER: certs.issuer,
          ACCESS_AUD: TEST_ACCESS_AUD,
          ACCESS_OWNER_EMAIL: TEST_OWNER_EMAIL,
        },
      },
    ],
  });

  try {
    await server.listen();
    // D1 の binding は Worker を起動してから扱える。訪問者の要求を送る前に当てる
    const worker = server.getWorker<{ DB: D1Database }>();
    await worker.applyD1Migrations('DB');
    const { DB: db } = await worker.getEnv();
    if (seedNotes) await seed(db);

    return {
      server,
      db,
      signAuthorJwt: (claims = {}) =>
        signAccessJwt(keys.privateJwk, { issuer: certs.issuer, ...claims }),
      close: async () => {
        await server.close();
        await certs.close();
      },
    };
  } catch (error) {
    await server.close();
    await certs.close();
    throw error;
  }
};

/** note と版の行をすべて、id の順に読む。操作の前後で行が変わらないことを確かめるのに使う */
export const readNoteRows = async (db: D1Database) => {
  const [notes, revisions] = await db.batch([
    db.prepare(
      'SELECT id, slug, status, published_revision_id, published_at, deleted_at FROM note ORDER BY id',
    ),
    db.prepare('SELECT id, note_id, title, body, created_at FROM note_revision ORDER BY id'),
  ]);
  return {
    note: notes.results as NoteRow[],
    noteRevision: revisions.results as NoteRevisionRow[],
  };
};

/** note の最新の版を読む */
export const readLatestRevision = async (db: D1Database, noteId: number) =>
  db
    .prepare('SELECT title, body FROM note_revision WHERE note_id = ? ORDER BY id DESC LIMIT 1')
    .bind(noteId)
    .first<{ title: string; body: string }>();

/** 表の行の数を読む */
export const countRows = async (db: D1Database, table: 'note' | 'note_revision') => {
  const row = await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
};
