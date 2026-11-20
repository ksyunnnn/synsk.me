import { SwitchField } from '@/shared/components/switch-field';

/**
 * 職歴・実績を秘匿化するかの Switch。値は `isMasked` の名前で `1`（秘匿化する）か `0`（秘匿化
 * しない）を送る。既定は秘匿化する（spec の FR-010・FR-015）。使い手は project と career の入力
 */
export const MaskingField = ({
  isMasked,
  description,
}: {
  /** 初めの値。`0` のときだけオフ */
  isMasked: string;
  description: string;
}) => (
  <SwitchField
    name="isMasked"
    label="秘匿化する"
    hint={description}
    defaultChecked={isMasked !== '0'}
    checkedValue="1"
    uncheckedValue="0"
  />
);
