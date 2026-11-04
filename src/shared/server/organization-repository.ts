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

/**
 * 組織名で探し、無ければ作る文。既にある組織が秘匿化した組織名を持たなければ `nameMasked`
 * を入れる。組織名の UNIQUE（FR-003）に当たれば作らない。職歴・実績の保存が、同じ
 * `batch()` の中で組織を指す行を書く前に並べる。後の文は組織を
 * `(SELECT id FROM organization WHERE name = ?)` で指す
 */
export const findOrCreateOrganizationStatements = (
  db: D1Database,
  name: string,
  nameMasked: string | null,
): D1PreparedStatement[] => [
  db
    .prepare(
      'INSERT INTO organization (name, name_masked) VALUES (?, ?) ON CONFLICT (name) DO NOTHING',
    )
    .bind(name, nameMasked),
  ...(nameMasked === null
    ? []
    : [
        db
          .prepare('UPDATE organization SET name_masked = ? WHERE name = ? AND name_masked IS NULL')
          .bind(nameMasked, name),
      ]),
];

export const createD1OrganizationRepository = (db: D1Database): OrganizationRepository => ({
  listNames: async () => {
    const { results } = await db
      .prepare('SELECT name FROM organization ORDER BY name')
      .all<Pick<OrganizationRow, 'name'>>();
    return results.map((row) => row.name);
  },

  findByName: async (name) => {
    const row = await db
      .prepare(`SELECT ${COLUMNS} FROM organization WHERE name = ?`)
      .bind(name)
      .first<OrganizationRow>();
    return row ? toOrganization(row) : null;
  },

  findOrCreateByName: async (name, nameMasked) => {
    // 探す・作る・読むを 1 つのトランザクションで送る
    // （https://developers.cloudflare.com/d1/worker-api/d1-database/）
    const results = await db.batch<OrganizationRow>([
      ...findOrCreateOrganizationStatements(db, name, nameMasked),
      db.prepare(`SELECT ${COLUMNS} FROM organization WHERE name = ?`).bind(name),
    ]);
    const row = results.at(-1)?.results[0];
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
