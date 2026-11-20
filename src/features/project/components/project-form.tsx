'use client';

import { useActionState, type ReactNode } from 'react';
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
import { PROJECT_KINDS, PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';
import { useDraft } from '@/shared/components/drafts';
import { FormActions } from '@/shared/components/form-actions';
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
    'この実績は、開いた後に別の画面で書き換えられていました。保存していません。入力した内容は残っています。開き直してから入力し直してください',
} as const;

/** 項目のまとまり。見出しで区切り、まとまりの中の項目を縦に並べる */
const FormGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-4">
    <h3 className="text-caption font-medium text-muted-foreground">{title}</h3>
    {children}
  </section>
);

export const ProjectForm = ({
  action,
  initialValues,
  organizationNames,
  skillOptions,
  project,
}: Props) => {
  const [result, formAction] = useActionState(action, null);
  // 保存せずに別の 1 件を選んでも、直しかけを残す（#366 の「直しかけの扱い」）
  const draft = useDraft(`project:${project?.uid ?? 'new'}`, initialValues);
  const { values, errors } = formStateOf(result, draft.values);
  const errorOf = (field: ProjectField) => {
    const reason = errors[field];
    return reason ? (ERROR_MESSAGES[field][reason] ?? RESULT_MESSAGES.invalid) : undefined;
  };

  const checkedSkillIds = new Set(values.skillIds.split(','));

  return (
    <form action={formAction} className="flex flex-col gap-8" {...draft.bind}>
      {project && (
        <>
          <input type="hidden" name={PROJECT_UID_FIELD} value={project.uid} />
          <input type="hidden" name={OPENED_UPDATED_AT_FIELD} value={project.updatedAt} />
        </>
      )}

      {result && result.status !== 'saved' && (
        <FormAlert>{RESULT_MESSAGES[result.status]}</FormAlert>
      )}

      {/* 公開の設定。オンとオフの 2 つを 1 つのまとまりに並べる */}
      <div className="divide-y divide-border rounded-2xl bg-muted/50 px-4">
        <SiteStatusField status={values.status} />
        <MaskingField
          isMasked={values.isMasked}
          description="訪問者には秘匿化した題と秘匿化した組織名で出し、本文と関連 URL を出しません"
        />
      </div>

      <FormGroup title="何を">
        <fieldset className="flex flex-col gap-1">
          <legend className="text-small font-medium">種類</legend>
          {/* 4 つから 1 つを選ぶ。値が少なく決まっているので、並べて一目で選べる形にする */}
          <div className="grid grid-cols-4 rounded-xl bg-muted p-0.5 text-small">
            {PROJECT_KINDS.map((kind) => (
              <label key={kind} className="relative">
                <input
                  type="radio"
                  name="kind"
                  value={kind}
                  defaultChecked={values.kind === kind}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-[10px] py-1.5 text-center text-muted-foreground transition-colors peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring motion-reduce:transition-none">
                  {PROJECT_KIND_LABELS[kind]}
                </span>
              </label>
            ))}
          </div>
          {errorOf('kind') && <p className="text-sm text-destructive">{errorOf('kind')}</p>}
        </fieldset>
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
            hint="続いているなら空にします"
            defaultValue={values.endedOn}
            error={errorOf('endedOn')}
          />
        </div>
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

      <FormActions>
        <SubmitButton className="rounded-full bg-tint px-5 py-2 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {project ? '保存する' : '登録する'}
        </SubmitButton>
      </FormActions>
    </form>
  );
};
