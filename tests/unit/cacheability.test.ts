import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0018 が定める、HTML をエッジのキャッシュに載せる 3 条件のうち 1 つ目を守る。
 *
 * `vinext build` の静的解析は App Router のページを分類できず、`dynamic` として
 * skip する。`export const revalidate` を書くことで ISR に分類される。1 つでも
 * 欠けると全経路が `cache-control: no-store, must-revalidate` と
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

const HAS_REVALIDATE = /^\s*export\s+const\s+revalidate\s*=/m;
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
      if (HAS_REVALIDATE.test(source)) continue;
      missing.push(relative(process.cwd(), page));
    }

    expect(missing).toEqual([]);
  });
});
