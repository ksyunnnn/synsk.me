import 'server-only';

import type { MediaUsage } from '@/shared/domain/media';

/**
 * 置いた画像の総量の D1 の実装（src/shared/domain/media.ts の `MediaUsage`）。`media` はすべての
 * 持ち主（note・実績・職歴・life event）の画像の行を持つため、表全体の `size` を合わせる
 */
export const createD1MediaUsage = (db: D1Database): MediaUsage => ({
  totalBytes: async () => {
    const row = await db
      .prepare('SELECT COALESCE(SUM(size), 0) AS total FROM media')
      .first<{ total: number }>();
    return row?.total ?? 0;
  },
});
