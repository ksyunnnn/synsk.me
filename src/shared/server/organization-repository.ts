import 'server-only';

import {
  PERSONAL_ORGANIZATION_ID,
  isPersonalOrganization,
  type Organization,
  type OrganizationId,
  type OrganizationRepository,
} from '@/shared/domain/organization';

/**
 * `OrganizationRepository` の D1 の実装。`organization` の行の型はこのファイルの中だけに置き、
 * domain の型に詰め替える（specs/001-career-and-project/research.md の R3）。
 * 列と CHECK の正本は migrations/ にある。
 */

/** `organization` の行のうち、ここで読む列 */
type OrganizationRow = {
  id: number;
  uid: string;
  name: string;
  name_masked: string | null;
  updated_at: string;
};

const COLUMNS = 'id, uid, name, name_masked, updated_at';

/** 職歴か実績がこの組織（id）を指す */
const REFERENCED = `(EXISTS (SELECT 1 FROM career WHERE organization_id = organization.id)
  OR EXISTS (SELECT 1 FROM project WHERE organization_id = organization.id))`;

/** 秘匿化した職歴か実績がこの組織（id）を指す */
const REFERENCED_BY_MASKED = `(EXISTS (SELECT 1 FROM career WHERE organization_id = organization.id AND is_masked = 1)
  OR EXISTS (SELECT 1 FROM project WHERE organization_id = organization.id AND is_masked = 1))`;

const isNameTaken = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: organization.name');

const toOrganization = (row: OrganizationRow): Organization => ({
  id: row.id,
  uid: row.uid,
  name: row.name,
  nameMasked: row.name_masked,
  updatedAt: row.updated_at,
});

/**
 * 組織名で探し、無ければ作る文。既にある組織が秘匿化した組織名を持たなければ `nameMasked`
 * を入れる。組織名の UNIQUE（FR-003）に当たれば作らない。職歴・実績の保存が、同じ
 * `batch()` の中で組織を指す行を書く前に並べる。後の文は組織を
 * `(SELECT id FROM organization WHERE name = ?)` で指す。
 *
 * `guard` を渡すと、その条件が真のときだけ書く。後の文が条件つきで拒まれうる保存は、拒まれる
 * ときに組織も書かないよう、後の文が当たる条件を渡す（docs/SOFTWARE_DESIGN.md の設計原則 1）。
 * `batch()` は 1 つのトランザクションのため、条件は後の文と同じ状態を読む
 * （https://developers.cloudflare.com/d1/worker-api/d1-database/#batch）
 */
export const findOrCreateOrganizationStatements = (
  db: D1Database,
  name: string,
  nameMasked: string | null,
  guard: { sql: string; values: unknown[] } = { sql: '1', values: [] },
): D1PreparedStatement[] => [
  // INSERT ... SELECT に ON CONFLICT を付けるときは、SELECT に WHERE が要る
  // （https://www.sqlite.org/lang_upsert.html の「Parsing Ambiguity」）
  db
    .prepare(
      `INSERT INTO organization (name, name_masked) SELECT ?, ? WHERE ${guard.sql}
       ON CONFLICT (name) DO NOTHING`,
    )
    .bind(name, nameMasked, ...guard.values),
  ...(nameMasked === null
    ? []
    : [
        db
          .prepare(
            `UPDATE organization SET name_masked = ?
             WHERE name = ? AND name_masked IS NULL AND ${guard.sql}`,
          )
          .bind(nameMasked, name, ...guard.values),
      ]),
];

/** 職歴・実績の保存のうち、組織を指す部分の内容 */
type OrganizationOfContent = {
  organizationName: string;
  organizationNameMasked: string | null;
  isMasked: boolean;
};

/** 組織名から組織の id を読む部分。組織の行は同じ batch の先の文が作る */
export const ORGANIZATION_ID_BY_NAME = '(SELECT id FROM organization WHERE name = ?)';

/**
 * 秘匿化する職歴・実績が、秘匿化した組織名を持つ組織を指すときだけ真になる条件（FR-001）。
 * 秘匿化しない職歴・実績では常に真。束ねる値は、秘匿化するか（0 か 1）と組織名
 */
export const MASKING_ALLOWED =
  '(? = 0 OR EXISTS (SELECT 1 FROM organization WHERE name = ? AND name_masked IS NOT NULL))';

/**
 * 登録の INSERT が当たるときだけ真になる条件。組織を探して作る文に渡し、拒まれる登録では組織も
 * 書かない（docs/SOFTWARE_DESIGN.md の設計原則 1）。秘匿化した組織名を渡す保存は、組織を探して
 * 作る文がその組織名を入れるため、`MASKING_ALLOWED` を満たす
 */
export const registerGuard = (content: OrganizationOfContent) => ({
  sql: `(? = 0 OR ? IS NOT NULL
    OR EXISTS (SELECT 1 FROM organization WHERE name = ? AND name_masked IS NOT NULL))`,
  values: [content.isMasked ? 1 : 0, content.organizationNameMasked, content.organizationName],
});

/**
 * 編集の UPDATE が当たるときだけ真になる条件。`table` の行があり、更新日時が開いたときと同じで、
 * `registerGuard` を満たす
 */
export const editGuard = (
  table: 'career' | 'project',
  id: number,
  openedUpdatedAt: string,
  content: OrganizationOfContent,
) => {
  const masking = registerGuard(content);
  return {
    sql: `(EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND updated_at = ?) AND ${masking.sql})`,
    values: [id, openedUpdatedAt, ...masking.values],
  };
};

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

  findIdByUid: async (uid) =>
    (
      await db
        .prepare('SELECT id FROM organization WHERE uid = ?')
        .bind(uid)
        .first<{ id: number }>()
    )?.id ?? null,

  list: async () => {
    const { results } = await db
      .prepare(`SELECT ${COLUMNS} FROM organization ORDER BY name`)
      .all<OrganizationRow>();
    return results.map(toOrganization);
  },

  findReferences: async (id) => {
    const row = await db
      .prepare(
        `SELECT ${REFERENCED} AS referenced, ${REFERENCED_BY_MASKED} AS referenced_by_masked
         FROM organization WHERE id = ?`,
      )
      .bind(id)
      .first<{ referenced: 0 | 1; referenced_by_masked: 0 | 1 }>();
    return {
      isReferenced: row?.referenced === 1,
      isReferencedByMasked: row?.referenced_by_masked === 1,
    };
  },

  edit: async (id, { name, nameMasked }) => {
    let changes: number;
    try {
      const result = await db
        .prepare(
          `UPDATE organization SET name = ?, name_masked = ?
           WHERE id = ? AND (? IS NOT NULL OR NOT ${REFERENCED_BY_MASKED})`,
        )
        .bind(name, nameMasked, id, nameMasked)
        .run();
      changes = result.meta.changes;
    } catch (error) {
      if (isNameTaken(error)) return { ok: false, reason: 'name-taken' };
      throw error;
    }
    if (changes > 0) return { ok: true };
    const exists = await db.prepare('SELECT 1 FROM organization WHERE id = ?').bind(id).first();
    return { ok: false, reason: exists ? 'masked-name-required' : 'not-found' };
  },

  delete: async (id) => {
    if (isPersonalOrganization(id)) return { ok: false, reason: 'personal' };
    const result = await db
      .prepare(`DELETE FROM organization WHERE id = ? AND id != ? AND NOT ${REFERENCED}`)
      .bind(id, PERSONAL_ORGANIZATION_ID)
      .run();
    if (result.meta.changes > 0) return { ok: true };
    const exists = await db.prepare('SELECT 1 FROM organization WHERE id = ?').bind(id).first();
    return { ok: false, reason: exists ? 'referenced' : 'not-found' };
  },
});
