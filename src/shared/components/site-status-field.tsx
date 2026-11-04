/**
 * 職歴・実績をサイトに載せるかを選ぶラジオボタンの並び。値は `status` の名前で `published`
 * （サイトに載せる）か `draft`（載せない）を送る。既定は載せない（spec の FR-044）。
 * 使い手は project と career の入力
 */

const RADIO =
  'size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const SiteStatusField = ({
  status,
}: {
  /** 初めに選ぶ値。`published` のときだけ「サイトに載せる」を選ぶ */
  status: string;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="font-bold">サイトに載せるか</legend>
    <p className="text-sm text-muted-foreground">
      載せないと、訪問者には出さず、管理画面と限定公開用の職務経歴書だけで使います
    </p>
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="status"
        value="draft"
        defaultChecked={status !== 'published'}
        className={RADIO}
      />
      サイトに載せない
    </label>
    <label className="flex items-center gap-2">
      <input
        type="radio"
        name="status"
        value="published"
        defaultChecked={status === 'published'}
        className={RADIO}
      />
      サイトに載せる
    </label>
  </fieldset>
);
