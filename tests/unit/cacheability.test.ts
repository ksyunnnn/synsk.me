import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0018 が定める、HTML をエッジのキャッシュに載せる 3 条件のうち 1 つ目を守る。
 *
 * `export const revalidate` がないページは `Unknown` に分類され、ISR にならない。
 * 1 つでも欠けると全経路が `cache-control: no-store, must-revalidate` と
 * `cf-cache-status: BYPASS` になる。
 *
 * `scripts/verify-deploy.mjs` の `cf-cache-status: HIT` 検査は本番へ配ったあとに
 * しか鳴らない。ページを 1 枚足した時点で落とすために、ここで検査する。
 */

const APP_DIR = join(process.cwd(), 'src/app');

async function findPages(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findPages(path)));
    } else if (entry.name === 'page.tsx' || entry.name === 'page.jsx') {
      found.push(path);
    }
  }
  return found;
}

// `revalidate = 0` は dynamic を意味する。ISR に分類されないため通さない
const HAS_POSITIVE_REVALIDATE =
  /^\s*export\s+const\s+revalidate\s*=\s*([1-9][0-9]*|false)\s*;?\s*$/m;
const HAS_FORCE_DYNAMIC = /^\s*export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/m;

describe('エッジのキャッシュに載る条件', () => {
  it('ページが 1 枚以上ある', async () => {
    const pages = await findPages(APP_DIR);
    expect(pages.length).toBeGreaterThan(0);
  });

  it('すべての page が revalidate を宣言する。force-dynamic を宣言するものは除く', async () => {
    const pages = await findPages(APP_DIR);
    const missing: string[] = [];

    for (const page of pages) {
      const source = await readFile(page, 'utf8');
      if (HAS_FORCE_DYNAMIC.test(source)) continue;
      if (HAS_POSITIVE_REVALIDATE.test(source)) continue;
      missing.push(relative(process.cwd(), page));
    }

    expect(missing).toEqual([]);
  });
});

describe('エッジのキャッシュに載る条件（設定側）', () => {
  /**
   * ADR-0018 が定める 3 条件の 2 つ目。`vite.config.ts` の `cdnAdapter()`、
   * `wrangler.jsonc` の `cache.enabled` と `version_metadata` の binding。
   *
   * 1 つでも欠けると全経路が `cf-cache-status: BYPASS` になる。条件 1 と同じく
   * 静的に確かめられるので、同じ層に置く。
   *
   * 3 つ目（`--experimental-warm-cdn-cache` の二段アップロード）はデプロイの
   * 経路にあり、ここでは確かめられない。`scripts/verify-deploy.mjs` が持つ。
   */
  it('vite.config.ts が cdnAdapter を使う', async () => {
    const source = await readFile(join(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(source).toMatch(/cdnAdapter\s*\(/);
    expect(source).toMatch(/cache\s*:\s*\{[^}]*cdn\s*:/);
  });

  it('wrangler.jsonc が cache.enabled と version_metadata を持つ', async () => {
    const source = await readFile(join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(source).toMatch(/"cache"\s*:\s*\{[^}]*"enabled"\s*:\s*true/);
    expect(source).toMatch(/"version_metadata"\s*:\s*\{[^}]*"binding"/);
  });
});
