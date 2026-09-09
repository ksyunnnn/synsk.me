#!/usr/bin/env node
// 本番へのデプロイ直後に走らせる検査。落ちたらデプロイを赤くする。
//
// 検査するのは、これまでに実際に壊れたもの。
// - 4 経路が返るか（#59 の完了条件）
// - OG 画像とアイコンが実体のある PNG か（satori と resvg が workerd で動くか）
// - HTML がエッジのキャッシュに載るか（#38 の後退。`export const revalidate` か
//   デプロイの `--experimental-warm-cdn-cache` が落ちると当たらなくなる）
// - アクセス解析のタグが埋まるか（#38。`next.config.js` の env が壊れると消える）
// - HTML とクライアント JS が予算に収まるか
//
// 使い方: node scripts/verify-deploy.mjs [URL]
// 既定の対象は https://synsk.me。プレビュー URL を渡してもよい。

import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { bypassCacheUrl, extractChunkPaths, isPng } from './lib/verify-deploy.mjs';

const BASE = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? 'https://synsk.me').replace(
  /\/$/,
  '',
);

/** gzip 後のバイト数の上限。2026-09-04 の実測は HTML 4.6 KB、JS 157 KB。 */
const BUDGET = { html: 8_000, js: 200_000 };

/** キャッシュの判定はブラウザ相当のヘッダでないと通らない。vinext の manifest が
 *  warm 時に確認した識別子だけを許可するため。 */
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9',
};

/**
 * このビルドが出した版。`X-Vinext-Build-Id` と同じ値が入る。
 *
 * 昇格の直後は古い版が応答しうる。これと突き合わせないと、前回のデプロイを
 * 測って緑を出すことになる。
 */
const EXPECTED_BUILD_ID = await readFile('dist/server/RSC_BUILD_ID', 'utf8')
  .then((text) => text.trim())
  .catch(() => null);

/**
 * 版の一致を必須にするかどうか。
 *
 * Workers Builds の中ではビルドとデプロイが同じ作業ディレクトリで走るため、
 * `dist/` は今回の出力である。手元から本番を見るときの `dist/` は古いことが
 * あるので、必須にしない。
 */
const ENFORCE_BUILD_ID = Boolean(process.env.WORKERS_CI_BRANCH) && Boolean(EXPECTED_BUILD_ID);

const failures = [];
const notes = new Set();

/** キャッシュから返ってきた HTML の版。`cf-cache-status: HIT` のときだけ持つ。 */
let cachedBuildId = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const check = (ok, label, detail) => {
  if (ok) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`  NG   ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
};

async function get(path, init = {}) {
  return fetch(`${BASE}${path}`, { headers: BROWSER_HEADERS, redirect: 'manual', ...init });
}

/**
 * エッジのキャッシュを迂回して、配信中の版そのものから取る。
 *
 * nonce は呼び出しごとに変える。同じ URL を繰り返すと、1 回目の応答がエッジの
 * キャッシュに載り、2 回目以降がそれを受け取る。CDN のアダプタはクエリに
 * 関わらず `CDN-Cache-Control` を付けるため、迂回の効果が消える。
 */
async function getFromOrigin(path) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return fetch(bypassCacheUrl(BASE, path, nonce), {
    headers: BROWSER_HEADERS,
    redirect: 'manual',
  });
}

/**
 * デプロイ直後は伝播の途中でありうる。昇格が全エッジに行き渡るまでの数秒間、
 * 古い版が応答することがある（#71）。200 を返すまで待つ。
 *
 * 最後の試行が例外だったときは、その例外を投げる。前の試行の古い応答を返すと、
 * 接続の失敗を「503 が返った」と誤って報告することになる。
 */
async function getWhenReady(fetcher, path, attempts = 12, intervalMs = 5_000) {
  let last;
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      last = await fetcher(path);
      lastError = undefined;
      if (last.ok) return last;
    } catch (error) {
      lastError = error;
    }
    if (i < attempts) await sleep(intervalMs);
  }
  if (lastError) throw lastError;
  if (!last) throw new Error(`取得できなかった: ${path}`);
  return last;
}

async function checkHtmlRoutes() {
  console.log('HTML の経路');
  const pages = {};
  for (const path of ['/', '/archives/2024']) {
    const res = await getWhenReady(get, path);
    const body = await res.text();
    pages[path] = body;
    // キャッシュから返ったときだけ版を控える。MISS の応答は配信中の版そのもの
    // なので、食い違いの検知には使えない
    if (path === '/' && res.headers.get('cf-cache-status') === 'HIT') {
      cachedBuildId = res.headers.get('x-vinext-build-id');
    }
    const type = res.headers.get('content-type') ?? '';
    check(
      res.status === 200 && type.startsWith('text/html'),
      `${path} が HTML を 200 で返す`,
      `${res.status} ${type}`,
    );
  }
  return pages;
}

async function checkImageRoutes() {
  console.log('画像の経路');
  for (const path of ['/icon', '/opengraph-image']) {
    const res = await getWhenReady(get, path);
    const bytes = new Uint8Array(await res.arrayBuffer());
    check(
      res.status === 200 && isPng(bytes),
      `${path} が PNG を 200 で返す`,
      `${res.status} ${bytes.length} バイト`,
    );
  }
}

/** 2 回目の取得でエッジのキャッシュに当たることを見る。warm の直後は当たるまで
 *  間があるため待つ。 */
async function checkEdgeCache() {
  console.log('エッジのキャッシュ');
  for (const path of ['/', '/archives/2024']) {
    let status = 'なし';
    for (let i = 1; i <= 6; i++) {
      await get(path);
      const res = await get(path);
      status = res.headers.get('cf-cache-status') ?? 'なし';
      if (status === 'HIT') break;
      await sleep(5_000);
    }
    check(status === 'HIT', `${path} の 2 回目が HIT を返す`, `cf-cache-status: ${status}`);
  }
}

/** `next.config.js` の env が `src/app/Analytics.tsx` に届いているか。
 *  プロダクション ブランチのビルドでのみ埋まる。 */
function checkAnalytics(html) {
  console.log('アクセス解析');
  const isProductionHost = new URL(BASE).hostname === 'synsk.me';
  if (!isProductionHost) {
    notes.add('アクセス解析の検査は synsk.me 以外では行わない');
    console.log('  skip アクセス解析のタグ — 対象が synsk.me ではない');
    return;
  }
  check(html.includes('googletagmanager'), 'HTML に GTM のタグが入る');
}

/** チャンクを 1 本取る。例外も「取れなかった」として扱い、検査を止めない。 */
async function fetchChunk(path) {
  try {
    const res = await getWhenReady(getFromOrigin, path, 3, 2_000);
    if (!res.ok) return { ok: false, reason: `${res.status}` };
    return { ok: true, bytes: gzipSync(Buffer.from(await res.text())).length };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * HTML とクライアント JS が予算に収まるかを見る。
 *
 * **HTML もチャンクもキャッシュを迂回して取る。**昇格の直後、キャッシュには
 * 新しい版の HTML があり、Worker はまだ古い版で応答することがある。片方だけを
 * 迂回すると、HTML と参照先のチャンクが別の版から来て 404 になる（#71）。
 *
 * さらに、迂回して揃えただけでは「古い版を測って緑」になりうる。Workers Builds
 * の中では、応答する版が今回のビルドと一致するまで待つ。
 */
async function checkBudget() {
  console.log('予算');
  const attempts = ENFORCE_BUILD_ID ? 8 : 2;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const lastAttempt = attempt === attempts;

    let res;
    try {
      res = await getWhenReady(getFromOrigin, '/', 3, 2_000);
    } catch (error) {
      if (lastAttempt) {
        check(false, '配信中の版から HTML を取れる', error instanceof Error ? error.message : '');
        return;
      }
      await sleep(5_000);
      continue;
    }

    const html = await res.text();
    const type = res.headers.get('content-type') ?? '';
    const originBuildId = res.headers.get('x-vinext-build-id');

    if (res.status !== 200 || !type.startsWith('text/html')) {
      if (lastAttempt) {
        check(false, '配信中の版から HTML を取れる', `${res.status} ${type}`);
        return;
      }
      await sleep(5_000);
      continue;
    }

    if (ENFORCE_BUILD_ID && originBuildId !== EXPECTED_BUILD_ID) {
      if (lastAttempt) {
        check(
          false,
          '配信中の版が今回のビルドと一致する',
          `期待 ${EXPECTED_BUILD_ID} / 応答 ${originBuildId}`,
        );
        return;
      }
      console.log('  ...  応答した版が今回のビルドと違う。昇格の伝播中とみて待つ');
      await sleep(5_000);
      continue;
    }

    const paths = extractChunkPaths(html);
    if (paths.length === 0) {
      if (lastAttempt) {
        check(false, 'HTML がクライアント JS を参照している', '0 本');
        return;
      }
      await sleep(5_000);
      continue;
    }

    const missing = [];
    let jsBytes = 0;
    for (const path of paths) {
      const chunk = await fetchChunk(path);
      if (chunk.ok) {
        jsBytes += chunk.bytes;
      } else {
        missing.push(`${path} (${chunk.reason})`);
      }
    }

    if (missing.length > 0 && !lastAttempt) {
      console.log(`  ...  ${missing.length} 本が取れない。版の伝播中とみて HTML から取り直す`);
      await sleep(10_000);
      continue;
    }

    if (ENFORCE_BUILD_ID) {
      check(true, '配信中の版が今回のビルドと一致する', EXPECTED_BUILD_ID);
    } else if (cachedBuildId && originBuildId && cachedBuildId !== originBuildId) {
      notes.add(
        `キャッシュの HTML と配信中の版が違う（cache ${cachedBuildId} / origin ${originBuildId}）。昇格の伝播中である`,
      );
    }

    const htmlBytes = gzipSync(Buffer.from(html)).length;
    check(
      htmlBytes <= BUDGET.html,
      `HTML が ${BUDGET.html} バイト以内（gzip）`,
      `${htmlBytes} バイト`,
    );

    for (const item of missing) check(false, `${item} が取得できる`);
    if (missing.length === 0) {
      check(
        jsBytes <= BUDGET.js,
        `クライアント JS が ${BUDGET.js} バイト以内（gzip）`,
        `${paths.length} チャンクで ${jsBytes} バイト`,
      );
    } else {
      console.log(
        `  skip クライアント JS の予算 — ${paths.length - missing.length}/${paths.length} 本しか取れていない`,
      );
    }
    return;
  }
}

console.log(`検査の対象: ${BASE}\n`);

const pages = await checkHtmlRoutes();
await checkImageRoutes();
await checkEdgeCache();
checkAnalytics(pages['/']);
await checkBudget();

console.log('');
for (const note of notes) console.log(`note: ${note}`);

if (failures.length > 0) {
  console.log(`\n${failures.length} 件が通らなかった。`);
  for (const label of failures) console.log(`  - ${label}`);
  process.exit(1);
}

console.log('すべて通った。');
