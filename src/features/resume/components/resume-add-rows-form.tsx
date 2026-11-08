'use client';

import { useActionState } from 'react';
import type { AddResumeRowsOutcome } from '@/features/resume/application/add-resume-rows';
import {
  BUTTON,
  messageOf,
  ResumeFormHidden,
  type ResumeFormCommon,
} from '@/features/resume/components/resume-form-parts';
import {
  SELECTION_MESSAGES,
  SourceFieldset,
  type SourceOption,
} from '@/features/resume/components/resume-source-fieldset';
import { SELECTION_KEY_OF_KIND, type ResumeRowKind } from '@/features/resume/domain/resume';
import {
  ROW_KIND_FIELD,
  SELECTION_FIELDS,
  type AddResumeRowsError,
} from '@/features/resume/domain/resume-forms';

/**
 * 作ったあとに、元の職歴・実績・学歴から選んで足すフォーム（specs/002-resume/contracts/dash.md の
 * `/dash/resumes/{id}/<種類>/new`、FR-041）。選び方は作成の画面と同じ部品（`SourceFieldset`）を
 * 使う。選択肢は何も選ばない状態で始まる（research.md の R14）。Server Action は props で受け取る
 * （ADR-0026 の依存の向き 3）
 */

type Props = ResumeFormCommon & {
  action: (state: AddResumeRowsOutcome | null, formData: FormData) => Promise<AddResumeRowsOutcome>;
  kind: ResumeRowKind;
  /** 種類の名前（職歴・実績・学歴） */
  legend: string;
  options: SourceOption[];
};

const errorText = (error: AddResumeRowsError, legend: string) => {
  if (error === 'missing') return `足す${legend}を選んでください`;
  if (error === 'already-copied') return `写し済みの${legend}があります。開き直してください`;
  if (error === 'public-not-supported') return '公開用にはまだ足せません';
  return SELECTION_MESSAGES[error];
};

export const ResumeAddRowsForm = ({
  action,
  kind,
  legend,
  options,
  resumeId,
  updatedAt,
}: Props) => {
  const [result, formAction] = useActionState(action, null);
  const selected = result && 'values' in result ? result.values : [];
  const error = result?.status === 'invalid' ? result.errors.selection : undefined;
  const message = messageOf(result);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <ResumeFormHidden resumeId={resumeId} updatedAt={updatedAt} />
      <input type="hidden" name={ROW_KIND_FIELD} value={kind} />
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{errorText(error, legend)}</p>}
      <SourceFieldset
        legend={legend}
        name={SELECTION_FIELDS[SELECTION_KEY_OF_KIND[kind]]}
        options={options}
        selected={selected}
        emptyText="足せるものはありません"
      />
      {options.length > 0 && (
        <div>
          <button type="submit" className={BUTTON}>
            足す
          </button>
        </div>
      )}
    </form>
  );
};
