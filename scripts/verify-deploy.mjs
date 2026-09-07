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

/** この実行を通して同じ値を使う。同じ版に対する一連の取得であることを揃える。 */
const NONCE = `${Date.now()}`;

const failures = [];
const notes = [];

/** キャッシュ経由で取れた HTML の版。配信中の版と食い違うかを見るために持つ。 */
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

/** エッジのキャッシュを迂回して、配信中の版そのものから取る。 */
async function getFromOrigin(path) {
  return fetch(bypassCacheUrl(BASE, path, NONCE), {
    headers: BROWSER_HEADERS,
    redirect: 'manual',
  });
}

/**
 * デプロイ直後は伝播の途中でありうる。昇格が全エッジに行き渡るまでの数秒間、
 * 古い版が応答して 404 を返すことがある（#71）。200 を返すまで待つ。
 */
async function getWhenReady(fetcher, path, attempts = 12, intervalMs = 5_000) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      last = await fetcher(path);
      if (last.ok) return last;
    } catch (error) {
      if (i === attempts) throw error;
    }
    if (i < attempts) await sleep(intervalMs);
  }
  return last;
}

async function checkHtmlRoutes() {
  console.log('HTML の経路');
  const pages = {};
  for (const path of ['/', '/archives/2024']) {
    const res = await getWhenReady(get, path);
    const body = await res.text();
    pages[path] = body;
    if (path === '/') cachedBuildId = res.headers.get('x-vinext-build-id');
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
    notes.push('アクセス解析の検査は synsk.me 以外では行わない');
    console.log('  skip アクセス解析のタグ — 対象が synsk.me ではない');
    return;
  }
  check(html.includes('googletagmanager'), 'HTML に GTM のタグが入る');
}

/**
 * HTML とクライアント JS が予算に収まるかを見る。
 *
 * **キャッシュ済みの HTML を使わない。**昇格の直後、キャッシュには新しい版の
 * HTML があり、Worker はまだ古い版で応答することがある。その HTML から抽出した
 * チャンクは古い版に存在せず 404 になる（#71）。配信中の版から HTML を取れば、
 * HTML とチャンクの版が揃う。
 */
async function checkBudget() {
  console.log('予算');
  const res = await getWhenReady(getFromOrigin, '/');
  const html = await res.text();
  const originBuildId = res.headers.get('x-vinext-build-id');
  if (cachedBuildId && originBuildId && cachedBuildId !== originBuildId) {
    notes.push(
      `キャッシュの HTML と配信中の版が違う（cache ${cachedBuildId} / origin ${originBuildId}）。昇格の伝播中である`,
    );
  }

  const htmlBytes = gzipSync(Buffer.from(html)).length;
  check(
    htmlBytes <= BUDGET.html,
    `HTML が ${BUDGET.html} バイト以内（gzip）`,
    `${htmlBytes} バイト`,
  );

  const paths = extractChunkPaths(html);
  let jsBytes = 0;
  for (const path of paths) {
    const chunk = await getWhenReady(get, path, 6, 5_000);
    if (!chunk.ok) {
      check(false, `${path} が取得できる`, `${chunk.status}`);
      continue;
    }
    jsBytes += gzipSync(Buffer.from(await chunk.text())).length;
  }
  check(
    jsBytes <= BUDGET.js,
    `クライアント JS が ${BUDGET.js} バイト以内（gzip）`,
    `${paths.length} チャンクで ${jsBytes} バイト`,
  );
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
