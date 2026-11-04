import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * 本番と同じ `migrations/` を当てた D1 が、001 が前提とする表の形を持つことを確かめる
 * （specs/001-career-and-project/research.md の R1）。各 Repository の実装の検査が、
 * この形の上で走る。
 */

type Column = { name: string; notnull: number };

const columnsOf = async (table: string) => {
  const { results } = await env.DB.prepare(
    'SELECT name, "notnull" FROM pragma_table_info(?) ORDER BY cid',
  )
    .bind(table)
    .all<Column>();
  return results;
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('migration 0008 の後の表', () => {
  it('organization.name_masked は NULL を持てる', async () => {
    const column = (await columnsOf('organization')).find((c) => c.name === 'name_masked');
    expect(column).toMatchObject({ notnull: 0 });
  });

  it('skill は months_override を持ち、years_override を持たない', async () => {
    const names = (await columnsOf('skill')).map((c) => c.name);
    expect(names).toContain('months_override');
    expect(names).not.toContain('years_override');
  });

  it('project は is_highlighted を持たない', async () => {
    const names = (await columnsOf('project')).map((c) => c.name);
    expect(names).not.toContain('is_highlighted');
    expect(names).toContain('is_masked');
  });
});
