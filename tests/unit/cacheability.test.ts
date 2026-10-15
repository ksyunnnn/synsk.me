import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * キャッシュを Cache Components で作る形を守る。
 *
 * キャッシュするものは `'use cache'` で選ぶ。ルートの設定の `revalidate`（ISR）・
 * `dynamic`・`fetchCache`・`dynamicParams` は書かない。Cache Components はこれらと両立せず、
 * `next build`（Next.js 16.3.4）は `Route segment config "revalidate" is not compatible
 * with \`nextConfig.cacheComponents\`. Please remove it.` で止まる（ほかの 3 つも同じ。
 * `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`）。
 * `vinext build` は止まらないため、ここで落とす。
 */

const APP_DIR = join(process.cwd(), 'src/app');

async function findSources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findSources(path)));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

const SEGMENT_CACHE_CONFIG = 'revalidate|dynamic|fetchCache|dynamicParams';

/** `export const revalidate = 60`、型注釈つき、`export { revalidate }` の形を拾う。 */
const DECLARES_SEGMENT_CACHE_CONFIG = [
  new RegExp(`^\\s*export\\s+(const|let|var)\\s+(${SEGMENT_CACHE_CONFIG})\\s*[:=]`, 'm'),
  new RegExp(`^\\s*export\\s*\\{[^}]*\\b(${SEGMENT_CACHE_CONFIG})\\b[^}]*\\}`, 'm'),
];

describe('キャッシュを Cache Components で作る', () => {
  it('next.config.js が cacheComponents を有効にする', async () => {
    const source = await readFile(join(process.cwd(), 'next.config.js'), 'utf8');
    expect(source).toMatch(/^\s*cacheComponents\s*:\s*true\s*,/m);
  });

  it('src/app のどのファイルも revalidate・dynamic・fetchCache・dynamicParams を宣言しない', async () => {
    const sources = await findSources(APP_DIR);
    expect(sources.length).toBeGreaterThan(0);
    const declaring: string[] = [];
    for (const path of sources) {
      const source = await readFile(path, 'utf8');
      if (DECLARES_SEGMENT_CACHE_CONFIG.some((pattern) => pattern.test(source))) {
        declaring.push(relative(process.cwd(), path));
      }
    }
    expect(declaring).toEqual([]);
  });
});

describe('エッジのキャッシュに載る条件（設定側）', () => {
  /**
   * ADR-0018 が定める 3 条件の 2 つ目。`vite.config.ts` の `cdnAdapter()`、
   * `wrangler.jsonc` の `cache.enabled` と `version_metadata` の binding。
   *
   * 1 つでも欠けると全経路が `cf-cache-status: BYPASS` になる。静的に確かめられるので、
   * この層に置く。
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
