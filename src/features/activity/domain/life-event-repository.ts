import type {
  LifeEvent,
  LifeEventContent,
  LifeEventId,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
import type { MediaStorageKey } from '@/shared/domain/media';
import type { Uid } from '@/shared/domain/uid';

/**
 * life event の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。D1 の実装は
 * src/features/activity/server/d1-life-event-repository.ts にある。life event は `activity` の行で、
 * どの文も `source = 'life_event'` の行だけを読み書きする
 */
export type LifeEventRepository = {
  /** 訪問者に見せる life event。DTO の列だけを読む。無い識別子なら null（FR-026・FR-034） */
  findVisitorBySlug: (slug: string) => Promise<VisitorLifeEvent | null>;
  /** 識別子の life event があるか。`findVisitorBySlug` が null を返さない識別子と一致する */
  hasSlug: (slug: string) => Promise<boolean>;
  /** オーナーが編集する life event。無い id なら null */
  findForEdit: (id: LifeEventId) => Promise<LifeEvent | null>;
  /** 管理画面の URL とフォームの uid が指す life event の id。無ければ null */
  findIdByUid: (uid: Uid) => Promise<LifeEventId | null>;
  /** オーナーの一覧。起きた日の新しい順 */
  list: () => Promise<LifeEventSummary[]>;
  /** 識別子がほかの life event と重なれば `slug-taken`（FR-035） */
  register: (
    content: LifeEventContent & { slug: string },
  ) => Promise<{ ok: true; id: LifeEventId; uid: Uid } | { ok: false; reason: 'slug-taken' }>;
  edit: (
    id: LifeEventId,
    content: LifeEventContent & { slug: string },
  ) => Promise<{ ok: true } | { ok: false; reason: 'slug-taken' | 'not-found' }>;
  /**
   * 行と、その life event の画像の行を 1 回の `batch()` で消す（FR-027）。消した画像の置き場の
   * キーを返し、呼び手が置き場から消す。無い id なら `ok: false`
   */
  delete: (
    id: LifeEventId,
  ) => Promise<{ ok: true; removedKeys: MediaStorageKey[] } | { ok: false }>;
  /**
   * 代表画像を置き換える（research.md の R12）。1 回の `batch()` で、新しい画像の行を入れ、代表画像を
   * 新しい行に書き換え、前の画像の行を消す。消した画像の置き場のキーを返す。無い id なら `ok: false`
   */
  replaceCardImage: (
    id: LifeEventId,
    storageKey: MediaStorageKey,
  ) => Promise<{ ok: true; removedKeys: MediaStorageKey[] } | { ok: false }>;
  /** 代表画像を外し、画像の行を消す。消した画像の置き場のキーを返す。無い id なら `ok: false` */
  removeCardImage: (
    id: LifeEventId,
  ) => Promise<{ ok: true; removedKeys: MediaStorageKey[] } | { ok: false }>;
  /**
   * 識別子の life event の代表画像が、その置き場のキーの画像か（FR-029・FR-030）。ほかの持ち主の
   * 画像と、代表画像でない画像では偽
   */
  isCardImage: (slug: string, storageKey: MediaStorageKey) => Promise<boolean>;
};
