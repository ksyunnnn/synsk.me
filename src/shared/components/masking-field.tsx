/**
 * 職歴・実績を秘匿化するかを選ぶラジオボタンの並び。値は `isMasked` の名前で `1`（秘匿化する）か
 * `0`（秘匿化しない）を送る。既定は秘匿化する（spec の FR-010・FR-015）。
 * 使い手は project と career の入力
 */

const RADIO =
  'size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const MaskingField = ({
  isMasked,
  description,
}: {
  /** 初めに選ぶ値。`0` のときだけ「秘匿化しない」を選ぶ */
  isMasked: string;
  description: string;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="font-bold">訪問者への見せ方</legend>
    <p className="text-sm text-muted-foreground">{description}</p>
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="isMasked"
        value="1"
        defaultChecked={isMasked !== '0'}
        className={RADIO}
      />
      秘匿化する
    </label>
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="isMasked"
        value="0"
        defaultChecked={isMasked === '0'}
        className={RADIO}
      />
      秘匿化しない（実際の値で出す）
    </label>
  </fieldset>
);
