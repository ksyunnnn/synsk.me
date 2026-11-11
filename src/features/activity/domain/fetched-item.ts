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

/**
 * URL を指名する取得元が 1 つの URL から取ったもの。題を返さない取得元（X）では題が無く、
 * オーナーが入れた題で保存する（plan.md の U11 の (a)）
 */
export type UrlFetchedItem = Omit<FetchedItem, 'title'> & { title?: string };

/**
 * 取得元が返した、変わったかを確かめる値（research.md の R9、migrations/0014）。ヘッダの文字列の
 * まま持ち、次の要求に同じ文字列を送る。取得元が返さなければ null
 */
export type Validators = { etag: string | null; lastModified: string | null };

export type SourceListing = {
  items: FetchedItem[];
  /** 取得元の項目をすべて取ったか。偽なら、一覧に無いことを消す根拠にしない（FR-018） */
  isComplete: boolean;
  /**
   * 次の要求で条件に使う値。1 本の要求で取得を終え、取得元がどちらかを返したときだけ持つ。
   * 頁を辿った取得元では、1 頁目が変わらなくても後の頁が変わりうるため持たない（R9）
   */
  validators?: Validators;
};

/** 個別の URL を取り直した結果。`gone` は 404、`present` は 2xx、`unknown` はそのほか（R6） */
export type GoneCheck = 'gone' | 'present' | 'unknown';

/** 条件付きの要求に、取得元が変わっていないと答えた（304） */
export type NotModified = { notModified: true };

/** 取得元ごとの取り直しの成否（docs/SOFTWARE_DESIGN.md の「失敗の表し方」）。投げずに返す */
export type RefreshOutcome =
  | {
      source: SourceName;
      ok: true;
      added: number;
      updated: number;
      /** 取得元で消えたと確かめて消した行の数（FR-017） */
      removed: number;
      /** 消す候補が上限を超えたので、消さずに残した行の数（FR-019） */
      keptOverLimit: number;
      /** 公開日が無いので取り込まなかった項目の数（FR-011） */
      skippedWithoutDate: number;
    }
  | { source: SourceName; ok: false; reason: string };
