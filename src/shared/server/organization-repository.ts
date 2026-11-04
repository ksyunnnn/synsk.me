import 'server-only';

import type {
  Organization,
  OrganizationId,
  OrganizationRepository,
} from '@/shared/domain/organization';

/**
 * `OrganizationRepository` の D1 の実装。`organization` の行の型はこのファイルの中だけに置き、
 * domain の型に詰め替える（specs/001-career-and-project/research.md の R3）。
 * 列と CHECK の正本は migrations/ にある。
 */

/** `organization` の行のうち、ここで読む列 */
type OrganizationRow = {
  id: number;
  name: string;
  name_masked: string | null;
  updated_at: string;
};

const COLUMNS = 'id, name, name_masked, updated_at';

const toOrganization = (row: OrganizationRow): Organization => ({
  id: row.id,
  name: row.name,
  nameMasked: row.name_masked,
  updatedAt: row.updated_at,
});

export const createD1OrganizationRepository = (db: D1Database): OrganizationRepository => ({
  listNames: async () => {
    const { results } = await db
      .prepare('SELECT name FROM organization ORDER BY name')
      .all<Pick<OrganizationRow, 'name'>>();
    return results.map((row) => row.name);
  },

  findOrCreateByName: async (name, nameMasked) => {
    // 組織名の UNIQUE（FR-003）に当たれば作らずに既にある行を読む。2 文を 1 つの
    // トランザクションで送る（https://developers.cloudflare.com/d1/worker-api/d1-database/）
    const [, selected] = await db.batch<OrganizationRow>([
      db
        .prepare(
          'INSERT INTO organization (name, name_masked) VALUES (?, ?) ON CONFLICT (name) DO NOTHING',
        )
        .bind(name, nameMasked),
      db.prepare(`SELECT ${COLUMNS} FROM organization WHERE name = ?`).bind(name),
    ]);
    const row = selected.results[0];
    if (!row) throw new Error('組織を作った後に読めなかった');
    return toOrganization(row);
  },

  findById: async (id: OrganizationId) => {
    const row = await db
      .prepare(`SELECT ${COLUMNS} FROM organization WHERE id = ?`)
      .bind(id)
      .first<OrganizationRow>();
    return row ? toOrganization(row) : null;
  },
});
