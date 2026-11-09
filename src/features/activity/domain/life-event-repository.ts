import type {
  LifeEvent,
  LifeEventContent,
  LifeEventId,
  LifeEventSummary,
  VisitorLifeEvent,
} from '@/features/activity/domain/life-event';
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
  /** 行を消す。無い id なら `ok: false` */
  delete: (id: LifeEventId) => Promise<{ ok: boolean }>;
};
