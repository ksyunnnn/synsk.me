import type { NoteId, SyndicationFieldError } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import { normalizeWebUrl } from '@/shared/domain/web-url';

export type AddNoteSyndicationOutcome =
  | { status: 'added' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: SyndicationFieldError };

/**
 * note に転載先の URL を記録する（FR-031・FR-032）。URL は http か https に限り、004 の取り込みと
 * 同じ `normalizeWebUrl` で揃えてから記録する（`src/shared/domain/web-url.ts`）。一覧（005）は
 * `syndication.url` と外部の activity の URL を文字列のまま比べて重複を除く（ADR-0006、
 * migrations/0018）ため、両方を同じ形で持つ。重複の判定も揃えた値で行う。オーナーでなければ
 * 何も書かない（FR-033）
 */
export const addNoteSyndication = async (
  notes: NoteRepository,
  author: Author | null,
  id: NoteId,
  value: string,
): Promise<AddNoteSyndicationOutcome> => {
  if (!author) return { status: 'forbidden' };
  if (value.trim() === '') return { status: 'invalid', error: 'missing' };
  const url = normalizeWebUrl(value);
  if (url === null) return { status: 'invalid', error: 'invalid' };

  const result = await notes.addSyndication(id, url);
  if (result.ok) return { status: 'added' };
  return result.reason === 'url-taken'
    ? { status: 'invalid', error: 'taken' }
    : { status: 'not-found' };
};
