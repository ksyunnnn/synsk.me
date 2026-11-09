/**
 * 外へ出す要求の上限の型（specs/004-external-activity/research.md の R8）。ユースケースと
 * 取得元ごとの処理は値を引数で受け取り、単体の検査は作り物の値を渡す。本番の値は
 * オーナーの承認（plan.md の U13）を待ってここに置く
 */
export type FetchLimits = {
  /** 1 回の取得で 1 つの取得元に出す要求の数 */
  maxRequests: number;
  /** 1 本の要求の待ち時間（ミリ秒）。超えたら失敗にする */
  timeoutMs: number;
  /** 1 本の応答の大きさ（バイト）。超えたら失敗にする */
  maxBytes: number;
};

/** 取り直しのユースケースが受け取る上限 */
export type RefreshLimits = FetchLimits & {
  /**
   * 1 回の取得で 1 つの取得元から消す件数。消す候補がこれを超えた回は 1 件も消さない
   * （FR-019、research.md の R6）
   */
  maxRemovals: number;
};
