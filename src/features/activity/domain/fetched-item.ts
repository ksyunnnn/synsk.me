/**
 * 取得元から取り込むものの型（specs/004-external-activity/data-model.md の「domain の型」）。
 * 取得元ごとの処理（src/features/activity/server/sources/）が外部の応答をこの形に詰め替える
 * （docs/SOFTWARE_DESIGN.md の Anti-Corruption Layer）
 */

/** 一覧での分類。値は `activity_source.kind` の CHECK（migrations/0007）と同じ */
export const SOURCE_KINDS = ['article', 'embed', 'life_event', 'other'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** 取り込み方（ADR-0052 の 3 通り）。保管するデータに持たない（FR-004） */
export const INTAKE_MODES = ['list', 'url', 'manual'] as const;
export type IntakeMode = (typeof INTAKE_MODES)[number];

/** 取得元の名前（`activity_source.source`） */
export type SourceName = string;

/** 取得元の 1 件を synsk.me の形にしたもの */
export type FetchedItem = {
  url: string;
  title: string;
  /** 公開日時。`YYYY-MM-DDTHH:MM:SS.sssZ`（UTC）。取得元が返さなければ無い */
  publishedAt?: string;
  /** 取得元での ID。返さない取得元では無く、URL で同じ項目を判定する（FR-008） */
  externalId?: string;
  /** 代表の画像の URL。返さない取得元では無い */
  imageUrl?: string;
};

/** 一覧を取る取得元の 1 回分の結果 */
export type SourceListing = {
  items: FetchedItem[];
  /** 取得元の項目をすべて取ったか。偽なら、一覧に無いことを消す根拠にしない（FR-018） */
  isComplete: boolean;
};

/** 取得元ごとの取り直しの成否（docs/SOFTWARE_DESIGN.md の「失敗の表し方」）。投げずに返す */
export type RefreshOutcome =
  | {
      source: SourceName;
      ok: true;
      added: number;
      updated: number;
      /** 公開日が無いので取り込まなかった項目の数（FR-011） */
      skippedWithoutDate: number;
    }
  | { source: SourceName; ok: false; reason: string };
