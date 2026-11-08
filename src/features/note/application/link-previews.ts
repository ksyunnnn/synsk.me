import { extractCardUrls, LINK_PREVIEW_MAX_FETCHES } from '@/features/note/domain/link-card';
import type { NoteDeps } from './deps';

/**
 * 本文のカードにする URL の参照先の情報を取り、保存する（specs/003-note/research.md の R9）。
 * `refresh` が false なら、情報を持っていない URL だけを取る。true なら、カードにする URL の
 * すべてを取り直す。取りに行く数は上限まで。取れた数を返す。取れなくても投げない
 */
export const collectLinkPreviews = async (
  { notes, fetchLinkPreviews, now }: Pick<NoteDeps, 'notes' | 'fetchLinkPreviews' | 'now'>,
  body: string,
  { refresh }: { refresh: boolean },
): Promise<number> => {
  const urls = extractCardUrls(body);
  if (urls.length === 0) return 0;
  const known = refresh
    ? new Set<string>()
    : new Set((await notes.findLinkPreviews(urls)).map((preview) => preview.url));
  const targets = urls.filter((url) => !known.has(url)).slice(0, LINK_PREVIEW_MAX_FETCHES);
  if (targets.length === 0) return 0;
  const previews = await fetchLinkPreviews(targets);
  await notes.saveLinkPreviews(previews, now());
  return previews.length;
};
