import { SwitchField } from '@/shared/components/switch-field';

/**
 * 職歴・実績をサイトに載せるかの Switch。値は `status` の名前で `published`（サイトに載せる）か
 * `draft`（載せない）を送る。既定は載せない（spec の FR-044）。使い手は project と career の入力
 */
export const SiteStatusField = ({
  status,
}: {
  /** 初めの値。`published` のときだけオン */
  status: string;
}) => (
  <SwitchField
    name="status"
    label="サイトに載せる"
    hint="オフにすると、訪問者には出さず、管理画面と限定公開用の職務経歴書だけで使います"
    defaultChecked={status === 'published'}
    checkedValue="published"
    uncheckedValue="draft"
  />
);
