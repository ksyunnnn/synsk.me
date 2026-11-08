'use client';

import { useActionState } from 'react';
import type { EditOutcome } from '@/features/resume/application/edit-outcome';
import {
  BUTTON,
  ResumeFormHidden,
  type ResumeFormCommon,
} from '@/features/resume/components/resume-form-parts';
import { InputField } from '@/shared/components/field';

/**
 * 限定公開用の URL と、URL を出し直すフォーム（specs/002-resume/contracts/dash.md の
 * `regenerateResumeUrl`、FR-040）。出し直すと識別子が新しい uid になり、古い URL は 404 になる
 */

type UrlResult = EditOutcome<Record<string, never>, Record<string, never>>;

const MESSAGES: Partial<Record<UrlResult['status'], string>> = {
  conflict:
    'この職務経歴書は、開いた後に別の画面で書き換えられていました。URL は出し直していません。開き直してください',
  forbidden: '作り手であることを確かめられませんでした。ログインし直してください',
};

export const ResumeUrlForm = ({
  action,
  url,
  ...common
}: ResumeFormCommon & {
  action: (state: UrlResult | null, formData: FormData) => Promise<UrlResult>;
  url: string;
}) => {
  const [result, formAction] = useActionState(action, null);
  const message = result ? MESSAGES[result.status] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ResumeFormHidden {...common} />
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <InputField name="limitedUrl" label="限定公開用の URL" readOnly defaultValue={url} />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">出し直すと、今の URL は開けなくなります</p>
        <div>
          <button type="submit" className={BUTTON}>
            URL を出し直す
          </button>
        </div>
      </div>
    </form>
  );
};
