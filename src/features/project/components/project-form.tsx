'use client';

import { useActionState } from 'react';
import {
  OPENED_UPDATED_AT_FIELD,
  PROJECT_UID_FIELD,
  type ProjectField,
  type ProjectFieldError,
  type ProjectFormResult,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import { InputField, TextareaField } from '@/shared/components/field';
import {
  FORBIDDEN_INPUT_MESSAGE,
  FormAlert,
  INVALID_INPUT_MESSAGE,
} from '@/shared/components/form-alert';
import { MaskingField } from '@/shared/components/masking-field';
import { OrganizationNameFields } from '@/shared/components/organization-name-fields';
import { PERIOD_FIELD_MESSAGES } from '@/shared/components/period-field-messages';
import { SiteStatusField } from '@/shared/components/site-status-field';
import { formStateOf } from '@/shared/domain/action-result';
import { DraftConflict, useDraft } from '@/shared/components/drafts';
import { FormActions } from '@/shared/components/form-actions';
import { KindField } from '@/shared/components/kind-field';
import { FormGroup, SettingsGroup } from '@/shared/components/form-group';
import { SubmitButton } from '@/shared/components/submit-button';

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
 * 組織名は、登録した組織の名前を選択肢に出す、ネイティブの `<datalist>` の入力にする（plan.md の U3）。
 */

type ProjectFormAction = (
  state: ProjectFormResult | null,
  formData: FormData,
) => Promise<ProjectFormResult>;

type Props = {
  action: ProjectFormAction;
  initialValues: ProjectFormValues;
  /** 組織名の選択肢。登録した組織の名前（FR-002） */
  organizationNames: string[];
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
  ...PERIOD_FIELD_MESSAGES,
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
  forbidden: FORBIDDEN_INPUT_MESSAGE,
  invalid: INVALID_INPUT_MESSAGE,
  conflict:
    'この実績は、開いた後に別の画面で保存されていました。保存していません。保存された内容を読み直します',
} as const;

/** 項目の名前。直しかけと、別の画面で保存された値の違いを知らせるのに使う */
const LABELS = {
  organizationName: '組織名',
  organizationNameMasked: '秘匿化した組織名',
  kind: '種類',
  title: '題',
  titleMasked: '秘匿化した題',
  isMasked: '秘匿化する',
  status: 'サイトに載せる',
  startedOn: '始まりの日',
  endedOn: '終わりの日',
  description: '本文',
  url: '関連 URL',
  slug: '識別子',
  skillIds: '使ったスキル',
};

export const ProjectForm = ({
  action,
  initialValues,
  organizationNames,
  skillOptions,
  project,
}: Props) => {
  const [result, formAction] = useActionState(action, null);
  // 保存せずに別の 1 件を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(`project:${project?.uid ?? 'new'}`, initialValues, result, LABELS);
  const { values, errors } = formStateOf(result, draft.values);
  const errorOf = (field: ProjectField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  const checkedSkillIds = new Set(values.skillIds.split(','));

  return (
    <form key={draft.formKey} action={formAction} className="flex flex-col gap-8" {...draft.bind}>
      <DraftConflict conflict={draft.conflict} noun="実績" />
      {project && (
        <>
          <input type="hidden" name={PROJECT_UID_FIELD} value={project.uid} />
          <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={project.updatedAt} />
        </>
      )}

      {result && result.status !== 'saved' && (
        <FormAlert>{RESULT_MESSAGES[result.status]}</FormAlert>
      )}

      <FormGroup title="何を">
        <KindField value={values.kind} error={errorOf('kind')} />
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
        <OrganizationNameFields
          organizationNames={organizationNames}
          organizationName={values.organizationName}
          organizationNameMasked={values.organizationNameMasked}
          errorOf={errorOf}
        />
      </FormGroup>

      <FormGroup title="いつ">
        <div className="grid gap-4 sm:grid-cols-2">
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
            defaultValue={values.endedOn}
            error={errorOf('endedOn')}
          />
        </div>
        <p className="-mt-2 text-caption text-muted-foreground">
          終わりの日は、続いているなら空にします
        </p>
      </FormGroup>

      <FormGroup title="中身">
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
          <legend className="text-small font-medium">使ったスキル</legend>
          {skillOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              スキルは、スキルの画面で登録するとここで選べます
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skillOptions.map((skill) => (
                <label key={skill.id}>
                  <input
                    type="checkbox"
                    name="skillIds"
                    value={skill.id}
                    defaultChecked={checkedSkillIds.has(String(skill.id))}
                    className="peer sr-only"
                  />
                  {/* 選んだスキルは塗り、選んでいないものは枠だけにし、色だけに頼らない（WCAG 2.2 SC 1.4.1） */}
                  <span className="block cursor-pointer rounded-full border border-border px-3 py-1 text-small transition-colors peer-checked:border-tint peer-checked:bg-tint peer-checked:text-tint-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring motion-reduce:transition-none">
                    {skill.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errorOf('skillIds') && <p className="text-sm text-destructive">{errorOf('skillIds')}</p>}
        </fieldset>
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
      </FormGroup>

      {/* 公開の設定は、何を・いつ・中身の入力の後に置く（HIG Layout の「Order content by relative
          importance」）。状態を隠さないよう、たたまずに出す */}
      <FormGroup title="公開">
        <SettingsGroup>
          <SiteStatusField status={values.status} />
          <MaskingField
            isMasked={values.isMasked}
            description="訪問者には秘匿化した題と秘匿化した組織名で出し、本文と関連 URL を出しません"
          />
        </SettingsGroup>
      </FormGroup>

      <FormActions>
        <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {project ? '保存する' : '登録する'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
