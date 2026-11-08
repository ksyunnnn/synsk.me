'use client';

import { useActionState } from 'react';
import {
  OPENED_UPDATED_AT_FIELD,
  PROJECT_UID_FIELD,
  PROJECT_KINDS,
  PROJECT_KIND_LABELS,
  type ProjectField,
  type ProjectFieldError,
  type ProjectFormResult,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import { InputField, SelectField, TextareaField } from '@/shared/components/field';
import { MaskingField } from '@/shared/components/masking-field';
import { SiteStatusField } from '@/shared/components/site-status-field';

/**
 * 実績を登録する・編集するフォーム（specs/001-career-and-project/contracts/dash.md）。
 *
 * Server Action は props で受け取る。このファイルは `server/` を読み込まない
 * （ADR-0026 の依存の向き 3）。`useActionState` に渡した Server Action は、JavaScript なしでも
 * フォームの送信で動く。失敗の結果は送られた値を持ち、入力を消さずに理由を示す。
 *
 * 入力の決まりはサーバで確かめ、誤りを文言で返す。`required` を付けない。ブラウザが送信を
 * 止めると、どの項目の何が合わないかを同じ形で伝えられないため。
 *
 * 組織名は、選択肢を出す部品が決まるまでネイティブの文字の入力にする（plan.md の U3）。
 */

type ProjectFormAction = (
  state: ProjectFormResult | null,
  formData: FormData,
) => Promise<ProjectFormResult>;

type Props = {
  action: ProjectFormAction;
  initialValues: ProjectFormValues;
  /** つなげるスキルの選択肢（FR-032） */
  skillOptions: { id: number; name: string }[];
  /** 編集する実績。持てば編集のフォームで、識別子の入力と、楽観ロックの値を送る */
  project?: { uid: string; updatedAt: string; isMasked: boolean };
};

const ERROR_MESSAGES: Record<ProjectField, Partial<Record<ProjectFieldError, string>>> = {
  organizationName: { missing: '組織名を入力してください' },
  organizationNameMasked: {
    'masked-name-required':
      '秘匿化するには、組織の秘匿化した組織名が要ります。秘匿化した組織名を入力してください',
  },
  kind: { invalid: '種類を選んでください' },
  title: { missing: '題を入力してください' },
  titleMasked: { missing: '秘匿化した題を入力してください' },
  isMasked: {},
  status: {},
  startedOn: {
    missing: '始まりの日を入力してください',
    invalid: '始まりの日を年月日で入力してください',
  },
  endedOn: {
    invalid: '終わりの日を年月日で入力してください',
    'ended-before-started': '終わりの日は始まりの日より前にできません',
  },
  description: {},
  url: { invalid: '関連 URL は http か https で始まる URL にしてください' },
  skillIds: { invalid: 'スキルを選び直してください' },
  slug: {
    missing: '識別子を入力してください',
    invalid: '識別子は英小文字・数字・ハイフンで、100 文字までにしてください',
    'slug-taken': 'この識別子はほかの実績が使っています',
    'masked-slug-locked': '秘匿化した実績の識別子は変えられません',
  },
};

const RESULT_MESSAGES = {
  forbidden: '作り手であることを確かめられませんでした。ログインし直してから入力し直してください',
  invalid: '入力を確かめてください',
  conflict:
    'この実績は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください',
} as const;

export const ProjectForm = ({ action, initialValues, skillOptions, project }: Props) => {
  const [result, formAction] = useActionState(action, null);
  const values: ProjectFormValues =
    result && 'values' in result ? { ...initialValues, ...result.values } : initialValues;
  const errors = result?.status === 'invalid' ? result.errors : {};
  const errorOf = (field: ProjectField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  const checkedSkillIds = new Set(values.skillIds.split(','));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {project && (
        <>
          <input type="hidden" name={PROJECT_UID_FIELD} value={project.uid} />
          <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={project.updatedAt} />
        </>
      )}

      {result && result.status !== 'saved' && (
        <p role="alert" className="text-destructive">
          {RESULT_MESSAGES[result.status]}
        </p>
      )}

      <SiteStatusField status={values.status} />

      <MaskingField
        isMasked={values.isMasked}
        description="秘匿化すると、訪問者には秘匿化した題と秘匿化した組織名で出し、本文と関連 URL を出しません"
      />

      <InputField
        name="organizationName"
        label="組織名"
        defaultValue={values.organizationName}
        autoComplete="off"
        error={errorOf('organizationName')}
      />
      <InputField
        name="organizationNameMasked"
        label="秘匿化した組織名"
        hint="組織が秘匿化した組織名を持たないときだけ使います。持っている組織の値は変えません"
        defaultValue={values.organizationNameMasked}
        autoComplete="off"
        error={errorOf('organizationNameMasked')}
      />
      <SelectField name="kind" label="種類" defaultValue={values.kind} error={errorOf('kind')}>
        {PROJECT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {PROJECT_KIND_LABELS[kind]}
          </option>
        ))}
      </SelectField>
      <InputField
        name="title"
        label="題"
        defaultValue={values.title}
        autoComplete="off"
        error={errorOf('title')}
      />
      <InputField
        name="titleMasked"
        label="秘匿化した題"
        defaultValue={values.titleMasked}
        autoComplete="off"
        error={errorOf('titleMasked')}
      />
      {project && (
        <InputField
          name="slug"
          label="識別子"
          hint={
            project.isMasked
              ? '秘匿化した実績の識別子は変えられません。秘匿化を外して保存した後に変えられます'
              : 'URL に出ます。英小文字・数字・ハイフンで、100 文字まで。秘匿化に切り替えると、新しい識別子になります'
          }
          defaultValue={values.slug}
          readOnly={project.isMasked}
          autoComplete="off"
          error={errorOf('slug')}
        />
      )}
      <InputField
        type="date"
        name="startedOn"
        label="始まりの日"
        defaultValue={values.startedOn}
        error={errorOf('startedOn')}
      />
      <InputField
        type="date"
        name="endedOn"
        label="終わりの日"
        hint="続いている実績は空にします"
        defaultValue={values.endedOn}
        error={errorOf('endedOn')}
      />
      <TextareaField
        name="description"
        label="本文"
        rows={8}
        defaultValue={values.description}
        error={errorOf('description')}
      />
      <InputField
        inputMode="url"
        name="url"
        label="関連 URL"
        defaultValue={values.url}
        autoComplete="off"
        error={errorOf('url')}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="font-bold">使ったスキル</legend>
        {skillOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            スキルは、スキルの画面で登録するとここで選べます
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {skillOptions.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="skillIds"
                  value={skill.id}
                  defaultChecked={checkedSkillIds.has(String(skill.id))}
                  className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                {skill.name}
              </label>
            ))}
          </div>
        )}
        {errorOf('skillIds') && <p className="text-sm text-destructive">{errorOf('skillIds')}</p>}
      </fieldset>

      <div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {project ? '保存する' : '登録する'}
        </button>
      </div>
    </form>
  );
};
