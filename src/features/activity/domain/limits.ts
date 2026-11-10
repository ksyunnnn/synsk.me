/**
 * 外へ出す要求の上限（specs/004-external-activity/research.md の R8）。ユースケースと取得元ごとの
 * 処理は値を引数で受け取り、単体の検査は作り物の値を渡す。本番の値はこのファイルの
 * `PRODUCTION_REFRESH_LIMITS` と `SOURCES_PER_RUN` だけに置く
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
  /**
   * すべて取らない取得元で、1 回の取得で個別の URL を取り直して消えたかを確かめる本数
   * （research.md の R6）。無いか 0 なら確かめない
   */
  maxGoneChecks?: number;
};

/**
 * 定期実行（worker/scheduled.ts）が使う本番の上限（research.md の R8）
 * - `maxRequests`・`timeoutMs`・`maxBytes`: 10 本・10 秒・1 MB。オーナーが 2026-11-10 に決めた（issue #219）
 * - `maxRemovals`: R8 の案の値（5 件）。消す件数の扱いは issue #280 で決める
 * - `maxGoneChecks`: 0。消えた URL を確かめる本数は issue #280 で決める。決まるまで確かめない
 */
export const PRODUCTION_REFRESH_LIMITS: RefreshLimits = {
  maxRequests: 10,
  timeoutMs: 10_000,
  maxBytes: 1024 * 1024,
  maxRemovals: 5,
  maxGoneChecks: 0,
};

/**
 * 1 回の起動で取り直す取得元の数（research.md の R8・R9）。オーナーが 2026-11-10 に、1 日 7 回の
 * 起動で 1 つずつと決めた（issue #219）。Workers Free の 1 回の Cron の CPU 時間 10 ms に、取得元
 * 1 つの解析だけを載せる
 */
export const SOURCES_PER_RUN = 1;
