import { InputField, SuggestingInputField } from '@/shared/components/field';

/**
 * 職歴・実績の組織名と秘匿化した組織名の入力の欄。組織名は、登録した組織の名前を候補に出す。
 * 使い手は project と career の入力
 */
export const OrganizationNameFields = ({
  organizationNames,
  organizationName,
  organizationNameMasked,
  errorOf,
}: {
  /** 組織名の候補。登録した組織の名前 */
  organizationNames: string[];
  organizationName: string;
  organizationNameMasked: string;
  errorOf: (field: 'organizationName' | 'organizationNameMasked') => string | undefined;
}) => (
  <>
    <SuggestingInputField
      name="organizationName"
      label="組織名"
      hint="登録した組織から選ぶか、新しい組織名を入力します"
      options={organizationNames}
      defaultValue={organizationName}
      autoComplete="off"
      error={errorOf('organizationName')}
    />
    <InputField
      name="organizationNameMasked"
      label="秘匿化した組織名"
      hint="組織が秘匿化した組織名を持たないときだけ使います。持っている組織の値は変えません"
      defaultValue={organizationNameMasked}
      autoComplete="off"
      error={errorOf('organizationNameMasked')}
    />
  </>
);
