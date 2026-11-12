/**
 * 期間の入力（始まりの日・終わりの日）の誤りの文言。誤りの値は、共有の `toPeriod` の結果を
 * 項目に移したもの（src/shared/domain/period.ts）。使い手は career・project・education・resume の
 * フォーム
 */
export const PERIOD_FIELD_MESSAGES = {
  startedOn: {
    missing: '始まりの日を入力してください',
    invalid: '始まりの日を年月日で入力してください',
  },
  endedOn: {
    invalid: '終わりの日を年月日で入力してください',
    'ended-before-started': '終わりの日は始まりの日より前にできません',
  },
} as const;
