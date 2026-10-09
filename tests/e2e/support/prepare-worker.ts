import { execFileSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { ACCESS_VARS, D1_PERSIST_DIR } from './author.ts';

/**
 * E2E で `wrangler dev` を起動する前に、ビルド出力を動かす準備をする。
 *
 * - ローカルの D1 を空にして `migrations/` を当てる。前の実行で作った note が
 *   残ると、同じ slug で作る操作が重複で落ちる
 * - `dist/server/.dev.vars` に `ACCESS_*` を書く。`wrangler dev` は設定ファイルと
 *   同じディレクトリの `.dev.vars` を読む。`dist/` はビルドのたびに作り直される
 *
 * `node tests/e2e/support/prepare-worker.ts` で走る。
 */

const CONFIG = 'dist/server/wrangler.json';

await rm(D1_PERSIST_DIR, { recursive: true, force: true });

// `--local` を明示する。本番の D1 に当てない
execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'synsk-me',
    '--local',
    '--config',
    CONFIG,
    '--persist-to',
    D1_PERSIST_DIR,
  ],
  // 対話の確認を出さない。標準入力を閉じると wrangler は既定の yes で進む
  { stdio: ['ignore', 'inherit', 'inherit'] },
);

await writeFile(
  'dist/server/.dev.vars',
  Object.entries(ACCESS_VARS)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n') + '\n',
);
