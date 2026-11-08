import { useId } from 'react';
import { InputField, type InputFieldProps } from '@/shared/components/field';

/**
 * 組織名の入力（specs/001-career-and-project/spec.md の FR-002）。自由に入力でき、登録した組織名を
 * 選択肢として出す。ネイティブの `<input list>` と `<datalist>` で作り、選択肢を開く・選ぶ・閉じる
 * 操作とキーボードの操作はブラウザに任せる（docs/SOFTWARE_DESIGN.md の「見た目と操作を分ける」、
 * 設計原則 9。plan.md の U3 の既定）。JavaScript なしでも同じに動く。
 *
 * 使い手は project と career の入力
 */
export const OrganizationNameField = ({
  options,
  ...props
}: InputFieldProps & {
  /** 登録した組織名。選択肢に出す */
  options: readonly string[];
}) => {
  const listId = `${useId()}-organization-names`;
  return (
    <>
      <InputField {...props} list={listId} autoComplete="off" />
      <datalist id={listId}>
        {options.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
};
