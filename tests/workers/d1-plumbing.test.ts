import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * ADR-0019 が Bad として残した未確認の risk を閉じる。
 *
 * `@cloudflare/vitest-plugin` は `miniflare 5.20260903.0-alpha` と
 * `wrangler 4.129.0` を同梱する。プロジェクトは `wrangler 4.128.0` を持つ。この
 * 版のずれが実際に問題になるかは、workerd を起こして D1 を触るまで分からない。
 *
 * 確かめるのは配管であって要件ではない。要件のテストは、その要件を実装する
 * issue が持つ。
 */

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('workerd の中で D1 を触る', () => {
  it('DB の binding がある', () => {
    expect(env.DB).toBeDefined();
    expect(typeof env.DB.prepare).toBe('function');
  });

  it('マイグレーションが適用され、テーブルが存在する', async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'probe'",
    ).first<{ name: string }>();
    expect(row?.name).toBe('probe');
  });

  it('書いて読める', async () => {
    await env.DB.prepare('INSERT INTO probe (id, visible, hidden) VALUES (?, ?, ?)')
      .bind('a', '出す値', '出さない値')
      .run();

    const row = await env.DB.prepare('SELECT visible, hidden FROM probe WHERE id = ?')
      .bind('a')
      .first<{ visible: string; hidden: string }>();

    expect(row?.visible).toBe('出す値');
    expect(row?.hidden).toBe('出さない値');
  });
});
