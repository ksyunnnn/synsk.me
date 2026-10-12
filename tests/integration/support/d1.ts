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
} as const;

export type NoteRow = { id: number; slug: string; title: string; body: string };
export type NotePublicationRow = {
  note_id: number;
  title: string;
  body: string;
  first_published_at: string;
};

const seed = async (db: D1Database) => {
  const { published, publishedWithChanges, draft } = SEEDED_NOTES;
  const insertNote = (id: number, slug: string, title: string, body: string) =>
    db
      .prepare('INSERT INTO note (id, slug, title, body) VALUES (?, ?, ?, ?)')
      .bind(id, slug, title, body);
  const insertPublication = (id: number, title: string, body: string, at: string) =>
    db
      .prepare(
        'INSERT INTO note_publication (note_id, title, body, first_published_at) VALUES (?, ?, ?, ?)',
      )
      .bind(id, title, body, at);

  await db.batch([
    insertNote(published.id, published.slug, published.title, published.body),
    insertPublication(published.id, published.title, published.body, published.firstPublishedAt),
    insertNote(
      publishedWithChanges.id,
      publishedWithChanges.slug,
      publishedWithChanges.draftTitle,
      publishedWithChanges.draftBody,
    ),
    insertPublication(
      publishedWithChanges.id,
      publishedWithChanges.title,
      publishedWithChanges.body,
      publishedWithChanges.firstPublishedAt,
    ),
    insertNote(draft.id, draft.slug, draft.title, draft.body),
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

/** note の行をすべて、id の順に読む。操作の前後で行が変わらないことを確かめるのに使う */
export const readNoteRows = async (db: D1Database) => {
  const [notes, publications] = await db.batch([
    db.prepare('SELECT id, slug, title, body FROM note ORDER BY id'),
    db.prepare(
      'SELECT note_id, title, body, first_published_at FROM note_publication ORDER BY note_id',
    ),
  ]);
  return {
    note: notes.results as NoteRow[],
    notePublication: publications.results as NotePublicationRow[],
  };
};

/** 表の行の数を読む */
export const countRows = async (db: D1Database, table: 'note' | 'note_publication') => {
  const row = await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
};
