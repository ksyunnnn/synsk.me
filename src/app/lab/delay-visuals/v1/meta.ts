import type { VersionMeta } from '../../_lab/registry';

export const meta: VersionMeta = {
  summary:
    'もとの映像をほぼ再現。写真を右から左へ出し、表示の境目の左は色を横に伸ばし、帯ごとに左へ追いついて揃うずれを重ねる。Canvas 2D の drawImage で写真を帯ごとに切り出してずらし、境目の列を横に引き伸ばして縞にする',
};
