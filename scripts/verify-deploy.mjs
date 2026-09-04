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

const failures = [];
const notes = [];

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

/** デプロイ直後は伝播の途中でありうる。200 を返すまで待つ。 */
async function getWhenReady(path, attempts = 12, intervalMs = 5_000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await get(path);
      if (res.ok) return res;
      if (i === attempts) return res;
    } catch (error) {
      if (i === attempts) throw error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`unreachable: ${path}`);
}

async function checkHtmlRoutes() {
  console.log('HTML の経路');
  const pages = {};
  for (const path of ['/', '/archives/2024']) {
    const res = await getWhenReady(path);
    const body = await res.text();
    pages[path] = body;
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
    const res = await getWhenReady(path);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    check(
      res.status === 200 && isPng,
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

async function checkBudget(html) {
  console.log('予算');
  const htmlBytes = gzipSync(Buffer.from(html)).length;
  check(
    htmlBytes <= BUDGET.html,
    `HTML が ${BUDGET.html} バイト以内（gzip）`,
    `${htmlBytes} バイト`,
  );

  const paths = [
    ...new Set(Array.from(html.matchAll(/"(\/_next\/static\/[^"]+\.js)"/g), (m) => m[1])),
  ];
  let jsBytes = 0;
  for (const path of paths) {
    const res = await get(path);
    if (!res.ok) {
      check(false, `${path} が取得できる`, `${res.status}`);
      continue;
    }
    jsBytes += gzipSync(Buffer.from(await res.text())).length;
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
await checkBudget(pages['/']);

console.log('');
for (const note of notes) console.log(`note: ${note}`);

if (failures.length > 0) {
  console.log(`\n${failures.length} 件が通らなかった。`);
  for (const label of failures) console.log(`  - ${label}`);
  process.exit(1);
}

console.log('すべて通った。');
