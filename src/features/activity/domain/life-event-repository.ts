import type { Uid } from '@/shared/domain/uid';
import type {
  LifeEvent,
  LifeEventContent,
  LifeEventId,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';

/**
 * life event の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。D1 の実装は
 * src/features/activity/server/d1-life-event-repository.ts にある。どの取り出しも
 * `source = 'life_event'` の行だけを読む
 */
export type LifeEventRepository = {
  /** 訪問者に見せる life event。無い識別子なら null（FR-034） */
  findVisitorBySlug: (slug: string) => Promise<VisitorLifeEvent | null>;
  /** 識別子の life event があるか。`findVisitorBySlug` が null を返さない識別子と一致する */
  hasSlug: (slug: string) => Promise<boolean>;
  findForEdit: (id: LifeEventId) => Promise<LifeEvent | null>;
  /** 管理画面の URL とフォームの uid が指す life event の id。外部の activity の uid は null */
  findIdByUid: (uid: Uid) => Promise<LifeEventId | null>;
  /** オーナーの一覧。起きた日の新しい順 */
  list: () => Promise<LifeEventSummary[]>;
  register: (
    content: LifeEventContent & { slug: string },
  ) => Promise<{ ok: true; id: LifeEventId; uid: Uid } | { ok: false; reason: 'slug-taken' }>;
  edit: (
    id: LifeEventId,
    content: LifeEventContent & { slug: string },
  ) => Promise<{ ok: true } | { ok: false; reason: 'slug-taken' | 'not-found' }>;
  /** life event と、その life event の画像の記録を 1 つのトランザクションで消す（FR-027） */
  delete: (id: LifeEventId) => Promise<{ ok: boolean }>;
};
