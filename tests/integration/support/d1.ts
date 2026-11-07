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
 * 経路を結合テストするための土台。
 *
 * 本番のビルド出力を `createTestHarness()` で起動し、D1 に `migrations/` を当て、
 * 作り物の行を入れる。JWT の検証の設定値 `ACCESS_*` は、テストが起動する公開鍵の
 * サーバへ向けて secret として渡す。本番のコードに試験用の分岐を持たせない。
 */

const CONFIG = './dist/server/wrangler.json';

export type TestServer = {
  server: ReturnType<typeof createTestHarness>;
  /** Worker が使うものと同じ D1。行を入れ、読み、表を消して読めない状態を作るのに使う */
  db: D1Database;
  /** 作り手の JWT。`Cf-Access-Jwt-Assertion` に入れる */
  signAuthorJwt: (claims?: { audience?: string; email?: string }) => Promise<string>;
  close: () => Promise<void>;
};

export type StartTestServerOptions = {
  /**
   * マイグレーションを当てた後、訪問者の要求を送る前に、作り物の行を入れる。
   * 行を入れる関数は tests/support/career-and-project-rows.ts にある
   */
  seed?: (db: D1Database) => Promise<void>;
};

/** ビルド出力を起動し、マイグレーションを当て、`seed` があれば作り物の行を入れる */
export const startTestServer = async ({
  seed,
}: StartTestServerOptions = {}): Promise<TestServer> => {
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
    if (seed) await seed(db);

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
