import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createAccessTestKeys, startAccessCertsServer } from '../../support/access.ts';
import { ACCESS_KEYS_PATH, ACCESS_SERVER_PORT } from './author.ts';

/**
 * E2E の webServer として走り、テスト用の鍵の組を作って公開鍵を配る。
 * 鍵の組は、テストのプロセスが作り手の JWT を作るために `ACCESS_KEYS_PATH` に書く。
 *
 * `node tests/e2e/support/access-server.ts` で走る。Playwright が終わるときに止める。
 */

const keys = await createAccessTestKeys();
await mkdir(dirname(ACCESS_KEYS_PATH), { recursive: true });
// サーバが応答する前に書く。Playwright は応答を待ってからテストを始める
await writeFile(ACCESS_KEYS_PATH, JSON.stringify(keys));
await startAccessCertsServer(keys.publicJwk, { port: ACCESS_SERVER_PORT });
