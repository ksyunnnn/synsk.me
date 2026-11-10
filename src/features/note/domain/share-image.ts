import type { VisitorNoteCardImage } from '@/features/note/domain/note';

/**
 * note を SNS で共有したときの画像（specs/003-note/plan.md の U8、research.md の R12）。大きい画像の
 * カードでなく、小さい画像の隣に文字が並ぶカードにするため、小さい正方形を出す（2026-11-10、
 * オーナー）。
 * - X の Summary Card は 1:1 で、最小 144×144
 * - Facebook は最小 200×200 https://developers.facebook.com/docs/sharing/webmasters/images/
 * - LinkedIn は幅 401 px 未満を小さい画像で出す https://www.linkedin.com/help/linkedin/answer/a521928
 */

/** 正方形の 1 辺の px。上の 3 つを満たす */
export const NOTE_SHARE_IMAGE_SIZE = 400;

/**
 * `site` の note に出す、サイト共通の小さい正方形の画像（`public/` の静的な画像）。サイト共通の
 * 1200×630 の画像（`src/app/opengraph-image.tsx`）は、note のページの外で使い続ける。
 * 拡張子の `.` は note の識別子に使えない文字のため、note の URL と重ならない
 */
export const SITE_NOTE_SHARE_IMAGE_PATH = '/note-card-site.png';

/** 共有したときの画像の経路。`media` は代表画像を正方形に縮めて配る経路 */
export const noteShareImagePath = (slug: string, cardImage: VisitorNoteCardImage): string =>
  cardImage.kind === 'media'
    ? `/notes/${encodeURIComponent(slug)}/card/${cardImage.storageKey}`
    : SITE_NOTE_SHARE_IMAGE_PATH;
